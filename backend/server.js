import express from 'express';
import cors from 'cors';
import session from 'express-session';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { fileURLToPath } from 'url';
import { initDatabase, seedDatabase, getDatabase, runQuery, fetchOne, fetchAll } from './db.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT || 5000);
const isProduction = process.env.NODE_ENV === 'production';

const uploadDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    name: 'sti.sid',
    secret: process.env.SESSION_SECRET || 'sti-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: 1000 * 60 * 60 * 8,
    },
  })
);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeBase = file.originalname
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9-_ ]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase();
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${safeBase}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
      return;
    }
    cb(new Error('Only PDF, DOCX and TXT files are allowed.'));
  },
});

const sanitizeUser = (user) => ({
  id: user.id,
  name: user.name,
  username: user.username,
  email: user.email,
  role: user.role,
  status: user.status,
  created_at: user.created_at,
});

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Authentication required.' });
  }
  next();
}

function requireRole(roles) {
  return async (req, res, next) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: 'Authentication required.' });
    }
    const user = await fetchOne('SELECT * FROM users WHERE id = ?', [req.session.userId]);
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ message: 'You do not have permission to perform this action.' });
    }
    next();
  };
}

app.use('/uploads', express.static(uploadDir));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Academic repository API is running.' });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  const user = await fetchOne(
    'SELECT * FROM users WHERE username = ? OR email = ?',
    [username, username]
  );

  if (!user) {
    return res.status(401).json({ message: 'Invalid username or password.' });
  }

  if (user.status !== 'active') {
    return res.status(403).json({ message: 'This account is inactive. Contact the administrator.' });
  }

  const passwordMatch = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatch) {
    return res.status(401).json({ message: 'Invalid username or password.' });
  }

  req.session.userId = user.id;
  return res.json({ message: 'Login successful.', user: sanitizeUser(user) });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('sti.sid');
    res.json({ message: 'Logged out successfully.' });
  });
});

app.get('/api/session', async (req, res) => {
  if (!req.session.userId) {
    return res.json({ user: null });
  }

  const user = await fetchOne('SELECT * FROM users WHERE id = ?', [req.session.userId]);
  if (!user) {
    req.session.destroy(() => res.clearCookie('sti.sid'));
    return res.json({ user: null });
  }

  return res.json({ user: sanitizeUser(user) });
});

app.get('/api/stats', requireRole(['admin']), async (_req, res) => {
  const [totalDocs, totalUsers, totalCategories, recentUploads] = await Promise.all([
    fetchOne('SELECT COUNT(*) as count FROM documents', []),
    fetchOne('SELECT COUNT(*) as count FROM users', []),
    fetchOne('SELECT COUNT(*) as count FROM categories', []),
    fetchAll('SELECT d.id, d.title, d.created_at, u.name as uploader FROM documents d LEFT JOIN users u ON u.id = d.uploader_id ORDER BY d.created_at DESC LIMIT 5', []),
  ]);

  res.json({
    totalDocuments: Number(totalDocs.count),
    totalUsers: Number(totalUsers.count),
    totalCategories: Number(totalCategories.count),
    recentUploads,
  });
});

app.get('/api/users', requireRole(['admin']), async (_req, res) => {
  const users = await fetchAll(
    'SELECT id, name, username, email, role, status, created_at FROM users ORDER BY created_at DESC',
    []
  );
  res.json({ users });
});

app.post('/api/users', requireRole(['admin']), async (req, res) => {
  const { name, username, email, password, role } = req.body || {};
  if (!name || !username || !email || !password || !role) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  const exists = await fetchOne('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
  if (exists) {
    return res.status(409).json({ message: 'A user with that username or email already exists.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await runQuery(
    'INSERT INTO users (name, username, email, password_hash, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime("now"), datetime("now"))',
    [name, username, email, passwordHash, role, 'active']
  );

  const user = await fetchOne('SELECT id, name, username, email, role, status, created_at FROM users WHERE id = ?', [result.lastID]);
  res.status(201).json({ message: 'User created successfully.', user });
});

app.get('/api/categories', async (_req, res) => {
  const categories = await fetchAll('SELECT * FROM categories ORDER BY name ASC', []);
  res.json({ categories });
});

app.post('/api/categories', requireRole(['admin']), async (req, res) => {
  const { name, description } = req.body || {};
  if (!name) {
    return res.status(400).json({ message: 'Category name is required.' });
  }

  const result = await runQuery(
    'INSERT INTO categories (name, description, created_at) VALUES (?, ?, datetime("now"))',
    [name.trim(), description || '']
  );

  const category = await fetchOne('SELECT * FROM categories WHERE id = ?', [result.lastID]);
  res.status(201).json({ message: 'Category added successfully.', category });
});

app.get('/api/documents', async (req, res) => {
  const { search, category, year, department, course } = req.query;
  const filters = [];
  const params = [];

  if (search) {
    const term = `%${String(search).trim()}%`;
    filters.push('(LOWER(d.title) LIKE ? OR LOWER(d.authors) LIKE ? OR LOWER(d.abstract) LIKE ? OR LOWER(d.course) LIKE ? OR LOWER(d.department) LIKE ? OR LOWER(c.name) LIKE ?)');
    params.push(term, term, term, term, term, term);
  }

  if (category) {
    filters.push('c.id = ?');
    params.push(Number(category));
  }

  if (year) {
    filters.push('d.year = ?');
    params.push(Number(year));
  }

  if (department) {
    filters.push('LOWER(d.department) LIKE ?');
    params.push(`%${String(department).toLowerCase()}%`);
  }

  if (course) {
    filters.push('LOWER(d.course) LIKE ?');
    params.push(`%${String(course).toLowerCase()}%`);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const documents = await fetchAll(
    `SELECT d.*, c.name AS category_name, u.name AS uploader_name
     FROM documents d
     LEFT JOIN categories c ON c.id = d.category_id
     LEFT JOIN users u ON u.id = d.uploader_id
     ${whereClause}
     ORDER BY d.created_at DESC`,
    params
  );

  res.json({ documents: documents.map((doc) => ({
    ...doc,
    canDownload: !doc.is_protected || ['admin', 'faculty'].includes(req.session.userRole || ''),
    fileUrl: doc.file_path ? `/uploads/${path.basename(doc.file_path)}` : null,
  })) });
});

app.get('/api/documents/:id', async (req, res) => {
  const document = await fetchOne(
    `SELECT d.*, c.name AS category_name, u.name AS uploader_name
     FROM documents d
     LEFT JOIN categories c ON c.id = d.category_id
     LEFT JOIN users u ON u.id = d.uploader_id
     WHERE d.id = ?`,
    [req.params.id]
  );

  if (!document) {
    return res.status(404).json({ message: 'Document not found.' });
  }

  const related = await fetchAll(
    `SELECT d.*
     FROM documents d
     WHERE d.id != ? AND (
       LOWER(d.title) LIKE ? OR LOWER(d.abstract) LIKE ? OR LOWER(d.authors) LIKE ?
     )
     ORDER BY d.created_at DESC
     LIMIT 4`,
    [document.id, `%${document.title.toLowerCase()}%`, `%${document.abstract.toLowerCase()}%`, `%${document.authors.toLowerCase()}%`]
  );

  res.json({ document: { ...document, related } });
});

app.post('/api/documents', requireRole(['faculty', 'admin']), upload.single('file'), async (req, res) => {
  const { title, authors, year, abstract, category_id, course, department, is_protected } = req.body;

  if (!title || !authors || !year || !abstract || !category_id) {
    return res.status(400).json({ message: 'Title, authors, year, abstract and category are required.' });
  }

  if (!req.file) {
    return res.status(400).json({ message: 'A document file is required.' });
  }

  const record = await runQuery(
    `INSERT INTO documents (title, authors, year, abstract, category_id, course, department, file_name, file_path, uploader_id, is_protected, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime("now"), datetime("now"))`,
    [
      title,
      authors,
      Number(year),
      abstract,
      Number(category_id),
      course || '',
      department || '',
      req.file.originalname,
      req.file.path,
      req.session.userId,
      is_protected === 'true' || is_protected === true ? 1 : 0,
    ]
  );

  const document = await fetchOne('SELECT * FROM documents WHERE id = ?', [record.lastID]);
  res.status(201).json({ message: 'Document uploaded successfully.', document });
});

app.get('/api/documents/:id/download', requireAuth, async (req, res) => {
  const document = await fetchOne('SELECT * FROM documents WHERE id = ?', [req.params.id]);
  if (!document) {
    return res.status(404).json({ message: 'Document not found.' });
  }

  const user = await fetchOne('SELECT role FROM users WHERE id = ?', [req.session.userId]);
  const isAuthorized = !document.is_protected || (user && ['admin', 'faculty'].includes(user.role));

  if (!isAuthorized) {
    return res.status(403).json({ message: 'You are not authorized to download this protected document.' });
  }

  const filePath = document.file_path;
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'The file is not available.' });
  }

  res.download(filePath, document.file_name || 'document');
});

app.get('/api/profile', requireAuth, async (req, res) => {
  const user = await fetchOne('SELECT id, name, username, email, role, status, created_at FROM users WHERE id = ?', [req.session.userId]);
  res.json({ user });
});

app.put('/api/profile', requireAuth, async (req, res) => {
  const { name, email, password } = req.body || {};
  const updateParts = [];
  const params = [];

  if (name) {
    updateParts.push('name = ?');
    params.push(name);
  }

  if (email) {
    updateParts.push('email = ?');
    params.push(email);
  }

  if (password) {
    updateParts.push('password_hash = ?');
    params.push(await bcrypt.hash(password, 10));
  }

  if (!updateParts.length) {
    return res.status(400).json({ message: 'No profile changes provided.' });
  }

  params.push(req.session.userId);
  await runQuery(`UPDATE users SET ${updateParts.join(', ')}, updated_at = datetime("now") WHERE id = ?`, params);
  const user = await fetchOne('SELECT id, name, username, email, role, status, created_at FROM users WHERE id = ?', [req.session.userId]);
  res.json({ message: 'Profile updated successfully.', user });
});

app.post('/api/chat', async (req, res) => {
  const question = (req.body && req.body.question) ? String(req.body.question).trim() : '';
  if (!question) {
    return res.status(400).json({ message: 'Please ask a question to search the repository.' });
  }

  const searchTerms = question.toLowerCase().split(/\s+/).filter(Boolean);
  const docs = await fetchAll(
    `SELECT d.*, c.name AS category_name
     FROM documents d
     LEFT JOIN categories c ON c.id = d.category_id
     WHERE LOWER(d.title) LIKE ?
        OR LOWER(d.authors) LIKE ?
        OR LOWER(d.abstract) LIKE ?
        OR LOWER(d.course) LIKE ?
        OR LOWER(d.department) LIKE ?
        OR LOWER(c.name) LIKE ?
     ORDER BY d.created_at DESC LIMIT 5`,
    [
      ...new Array(6).fill(`%${question.toLowerCase()}%`),
    ]
  );

  const fallbackSummary = docs.length
    ? docs.map((doc) => `${doc.title} by ${doc.authors} (${doc.year})`).join('; ')
    : 'No repository documents matched the question.';

  let finalAnswer = `I found ${docs.length} relevant document(s) in the repository. ${fallbackSummary}`;
  let aiUsed = false;

  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const chunks = docs.slice(0, 3).map((doc) => `${doc.title} - ${doc.abstract}`);
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an assistant helping users find academic documents from a repository. Use only the provided repository context. Clearly label AI-generated content and never fabricate documents or authors.',
          },
          {
            role: 'user',
            content: `User question: ${question}\nRepository context:\n${chunks.join('\n---\n') || 'No results found.'}`,
          },
        ],
      });

      finalAnswer = completion.choices[0]?.message?.content || finalAnswer;
      aiUsed = true;
    } catch (error) {
      finalAnswer = `AI generation was unavailable. Repository fallback response: ${finalAnswer}`;
      aiUsed = false;
    }
  }

  if (req.session.userId) {
    await runQuery(
      'INSERT INTO chat_history (user_id, question, response, created_at) VALUES (?, ?, ?, datetime("now"))',
      [req.session.userId, question, finalAnswer]
    );
  }

  res.json({
    answer: finalAnswer,
    results: docs,
    aiUsed,
    source: aiUsed ? 'OpenAI API' : 'Repository keyword search fallback',
  });
});

app.get('/api/chat/history', requireAuth, async (req, res) => {
  const history = await fetchAll(
    'SELECT id, question, response, created_at FROM chat_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
    [req.session.userId]
  );
  res.json({ history });
});

app.listen(PORT, async () => {
  await initDatabase();
  await seedDatabase();
  console.log(`STI repository server running on http://localhost:${PORT}`);
});

process.on('SIGINT', () => {
  const db = getDatabase();
  if (db && typeof db.close === 'function') {
    db.close();
  }
  process.exit(0);
});
