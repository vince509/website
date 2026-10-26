import express from 'express';
import cors from 'cors';
import session from 'express-session';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { initDatabase, seedDatabase, fetchAll, fetchOne, runQuery, getDatabase } from './db.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT || 5000);
const uploadDir = path.join(__dirname, 'uploads');

fs.mkdirSync(uploadDir, { recursive: true });

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  name: 'sti.sid',
  secret: process.env.SESSION_SECRET || 'sti-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 1000 * 60 * 60 * 8,
  },
}));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9-_ ]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase();
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${safe}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only PDF, DOCX and TXT files are allowed.'));
  },
});

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role,
    status: user.status,
    created_at: user.created_at,
  };
}

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
  res.json({ status: 'ok', message: 'STI repository API is running.' });
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

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return res.status(401).json({ message: 'Invalid username or password.' });
  }

  if (user.status !== 'active') {
    return res.status(403).json({ message: 'This account is inactive. Contact the administrator.' });
  }

  req.session.userId = user.id;
  res.json({ message: 'Login successful.', user: sanitizeUser(user) });
});

app.get('/api/session', async (req, res) => {
  if (!req.session.userId) return res.json({ user: null });

  const user = await fetchOne('SELECT * FROM users WHERE id = ?', [req.session.userId]);
  if (!user) {
    req.session.destroy(() => {});
    return res.json({ user: null });
  }

  res.json({ user: sanitizeUser(user) });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('sti.sid');
    res.json({ message: 'Logged out successfully.' });
  });
});

app.get('/api/categories', async (_req, res) => {
  const categories = await fetchAll('SELECT * FROM categories ORDER BY name ASC');
  res.json({ categories });
});

app.post('/api/categories', requireRole(['admin']), async (req, res) => {
  const { name, description } = req.body || {};
  if (!name) {
    return res.status(400).json({ message: 'Category name is required.' });
  }

  const result = await runQuery(
    'INSERT INTO categories (name, description, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
    [String(name).trim(), description || '']
  );

  const category = await fetchOne('SELECT * FROM categories WHERE id = ?', [result.lastID]);
  res.status(201).json({ category });
});

app.get('/api/stats', requireRole(['admin']), async (_req, res) => {
  const totalDocuments = await fetchOne('SELECT COUNT(*) as count FROM documents');
  const totalUsers = await fetchOne('SELECT COUNT(*) as count FROM users');
  const totalCategories = await fetchOne('SELECT COUNT(*) as count FROM categories');

  res.json({
    totalDocuments: Number(totalDocuments.count),
    totalUsers: Number(totalUsers.count),
    totalCategories: Number(totalCategories.count),
  });
});

app.get('/api/users', requireRole(['admin']), async (_req, res) => {
  const users = await fetchAll('SELECT id, name, username, email, role, status, created_at FROM users ORDER BY created_at DESC');
  res.json({ users });
});

app.post('/api/users', requireRole(['admin']), async (req, res) => {
  const { name, username, email, password, role } = req.body || {};
  if (!name || !username || !email || !password || !role) {
    return res.status(400).json({ message: 'All user fields are required.' });
  }

  const exists = await fetchOne('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
  if (exists) {
    return res.status(409).json({ message: 'Username or email already exists.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await runQuery(
    'INSERT INTO users (name, username, email, password_hash, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, "active", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
    [name, username, email, passwordHash, role]
  );

  const user = await fetchOne('SELECT id, name, username, email, role, status, created_at FROM users WHERE id = ?', [result.lastID]);
  res.status(201).json({ user, message: 'User created successfully.' });
});

app.get('/api/documents', async (req, res) => {
  const { search, category, year, department, course } = req.query;

  let sql = `
    SELECT d.*, c.name AS category_name
    FROM documents d
    LEFT JOIN categories c ON c.id = d.category_id
  `;
  const params = [];
  const filters = [];

  if (search) {
    filters.push('(LOWER(d.title) LIKE ? OR LOWER(d.authors) LIKE ? OR LOWER(d.abstract) LIKE ? OR LOWER(d.course) LIKE ? OR LOWER(d.department) LIKE ? OR LOWER(c.name) LIKE ?)');
    const term = `%${String(search).toLowerCase()}%`;
    params.push(term, term, term, term, term, term);
  }

  if (category) {
    filters.push('d.category_id = ?');
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

  if (filters.length) sql += ` WHERE ${filters.join(' AND ')}`;
  sql += ' ORDER BY d.created_at DESC';

  const documents = await fetchAll(sql, params);

  const transformed = documents.map((doc) => ({
    ...doc,
    fileUrl: doc.file_path ? `/uploads/${path.basename(doc.file_path)}` : null,
  }));

  res.json({ documents: transformed });
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

  if (!document) return res.status(404).json({ message: 'Document not found.' });

  const related = await fetchAll(
    `SELECT * FROM documents WHERE id != ? AND (
      LOWER(title) LIKE ? OR LOWER(authors) LIKE ? OR LOWER(abstract) LIKE ?
    ) ORDER BY created_at DESC LIMIT 4`,
    [
      document.id,
      `%${String(document.title || '').toLowerCase()}%`,
      `%${String(document.authors || '').toLowerCase()}%`,
      `%${String(document.abstract || '').toLowerCase()}%`,
    ]
  );

  res.json({ document: { ...document, related, fileUrl: document.file_path ? `/uploads/${path.basename(document.file_path)}` : null } });
});

app.post('/api/documents', requireRole(['faculty', 'admin']), upload.single('file'), async (req, res) => {
  const { title, authors, year, abstract, category_id, course, department, is_protected } = req.body || {};

  if (!title || !authors || !year || !abstract || !category_id) {
    return res.status(400).json({ message: 'Title, authors, year, abstract and category are required.' });
  }

  if (!req.file) {
    return res.status(400).json({ message: 'A document file is required.' });
  }

  const result = await runQuery(
    `INSERT INTO documents (title, authors, year, abstract, category_id, course, department, file_name, file_path, uploader_id, is_protected, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
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
      is_protected === 'true' ? 1 : 0,
    ]
  );

  const document = await fetchOne('SELECT * FROM documents WHERE id = ?', [result.lastID]);
  res.status(201).json({ document, message: 'Document uploaded successfully.' });
});

app.get('/api/documents/:id/download', requireAuth, async (req, res) => {
  const document = await fetchOne('SELECT * FROM documents WHERE id = ?', [req.params.id]);
  if (!document) return res.status(404).json({ message: 'Document not found.' });

  const user = await fetchOne('SELECT role FROM users WHERE id = ?', [req.session.userId]);
  const canDownload = !document.is_protected || (user && ['admin', 'faculty'].includes(user.role));

  if (!canDownload) {
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
  const updates = [];
  const params = [];

  if (name) {
    updates.push('name = ?');
    params.push(name);
  }

  if (email) {
    updates.push('email = ?');
    params.push(email);
  }

  if (password) {
    updates.push('password_hash = ?');
    params.push(await bcrypt.hash(password, 10));
  }

  if (!updates.length) {
    return res.status(400).json({ message: 'No valid changes provided.' });
  }

  params.push(req.session.userId);
  await runQuery(`UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, params);

  const user = await fetchOne('SELECT id, name, username, email, role, status, created_at FROM users WHERE id = ?', [req.session.userId]);
  res.json({ user, message: 'Profile updated successfully.' });
});

app.post('/api/chat', async (req, res) => {
  const question = String(req.body?.question || '').trim();
  if (!question) return res.status(400).json({ message: 'Please ask a question to search the repository.' });

  const sql = `
    SELECT d.*, c.name AS category_name
    FROM documents d
    LEFT JOIN categories c ON c.id = d.category_id
    WHERE LOWER(d.title) LIKE ?
       OR LOWER(d.authors) LIKE ?
       OR LOWER(d.abstract) LIKE ?
       OR LOWER(d.course) LIKE ?
       OR LOWER(d.department) LIKE ?
       OR LOWER(c.name) LIKE ?
    ORDER BY d.created_at DESC
    LIMIT 5
  `;

  const params = new Array(6).fill(`%${question.toLowerCase()}%`);
  const results = await fetchAll(sql, params);

  let answer = results.length
    ? `I found ${results.length} relevant repository document(s). ${results.map((doc) => `${doc.title} by ${doc.authors}`).join('; ')}`
    : 'No matching documents were found in the repository. Try a broader question or check a different course or keyword.';

  if (req.session.userId) {
    await runQuery('INSERT INTO chat_history (user_id, question, response, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)', [req.session.userId, question, answer]);
  }

  res.json({
    answer,
    results,
    aiUsed: false,
    source: 'Repository keyword search fallback',
  });
});

app.get('/api/chat/history', requireAuth, async (req, res) => {
  const history = await fetchAll('SELECT id, question, response, created_at FROM chat_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 10', [req.session.userId]);
  res.json({ history });
});

app.listen(PORT, async () => {
  await initDatabase();
  await seedDatabase();
  console.log(`STI repository server running on http://localhost:${PORT}`);
});

process.on('SIGINT', () => {
  const db = getDatabase();
  if (db && typeof db.close === 'function') db.close();
  process.exit(0);
});
