import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

export function getDatabase() {
  return db;
}

export function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
        return;
      }
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export function fetchAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

export function fetchOne(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

export async function initDatabase() {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('student', 'faculty', 'admin')),
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      authors TEXT NOT NULL,
      year INTEGER,
      abstract TEXT,
      category_id INTEGER,
      course TEXT,
      department TEXT,
      file_name TEXT,
      file_path TEXT,
      uploader_id INTEGER,
      is_protected INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (uploader_id) REFERENCES users(id)
    );
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS chat_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      question TEXT NOT NULL,
      response TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      document_id INTEGER,
      action TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (document_id) REFERENCES documents(id)
    );
  `);

  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_documents_title ON documents(title);',
    'CREATE INDEX IF NOT EXISTS idx_documents_author ON documents(authors);',
    'CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category_id);',
    'CREATE INDEX IF NOT EXISTS idx_documents_department ON documents(department);',
    'CREATE INDEX IF NOT EXISTS idx_chat_user ON chat_history(user_id);',
  ];

  for (const sql of indexes) {
    await runQuery(sql);
  }
}

export async function seedDatabase() {
  const adminExists = await fetchOne('SELECT id FROM users WHERE username = ?', ['admin']);
  if (adminExists) {
    return;
  }

  const adminHash = await bcrypt.hash('Admin123!', 10);
  const facultyHash = await bcrypt.hash('Faculty123!', 10);
  const studentHash = await bcrypt.hash('Student123!', 10);

  await runQuery(`
    INSERT INTO categories (name, description, created_at) VALUES
     ('AI & Data Science', 'Artificial intelligence and data-driven research.', datetime('now')),
     ('Cybersecurity', 'Study of secure systems, digital trust and information protection.', datetime('now')),
     ('Education Technology', 'Technology-enabled learning, pedagogy and learning analytics.', datetime('now')),
     ('Systems & Networks', 'Infrastructure, networking and system design.', datetime('now'));
  `);

  const adminUser = await runQuery(
    `INSERT INTO users (name, username, email, password_hash, role, status, created_at, updated_at)
     VALUES ('System Administrator', 'admin', 'admin@sti.edu', ?, 'admin', 'active', datetime('now'), datetime('now'))`,
    [adminHash]
  );

  await runQuery(
    `INSERT INTO users (name, username, email, password_hash, role, status, created_at, updated_at)
     VALUES ('Faculty Member', 'faculty', 'faculty@sti.edu', ?, 'faculty', 'active', datetime('now'), datetime('now'))`,
    [facultyHash]
  );

  await runQuery(
    `INSERT INTO users (name, username, email, password_hash, role, status, created_at, updated_at)
     VALUES ('Student User', 'student', 'student@sti.edu', ?, 'student', 'active', datetime('now'), datetime('now'))`,
    [studentHash]
  );

  const docs = [
    {
      title: 'AI-Driven Learning Analytics in Higher Education',
      authors: 'R. Santos, M. Aquino',
      year: 2024,
      abstract: 'This study evaluates learner engagement patterns and academic outcomes in digital learning environments using AI-powered analytics and adaptive feedback.',
      category_id: 1,
      course: 'Information Technology',
      department: 'College of Computing Studies',
      file_name: 'ai-learning-analytics.txt',
      file_path: path.join(__dirname, 'uploads', 'demo-ai-learning-analytics.txt'),
      uploader_id: adminUser.lastID,
      is_protected: 0,
    },
    {
      title: 'Secure Mobile Banking Systems with Multi-Factor Authentication',
      authors: 'A. Reyes, J. Dela Cruz',
      year: 2023,
      abstract: 'The paper examines secure authentication patterns and transaction monitoring strategies for mobile financial applications.',
      category_id: 2,
      course: 'Computer Security',
      department: 'College of Computing Studies',
      file_name: 'secure-mobile-banking.txt',
      file_path: path.join(__dirname, 'uploads', 'demo-secure-mobile-banking.txt'),
      uploader_id: adminUser.lastID,
      is_protected: 1,
    },
    {
      title: 'Improving Student Retention Through Digital Feedback Systems',
      authors: 'P. Manalo, C. Garcia',
      year: 2022,
      abstract: 'A study on how timely digital feedback and learner dashboards improve academic retention and course completion in undergraduate programs.',
      category_id: 3,
      course: 'Education Technology',
      department: 'School of Teacher Education',
      file_name: 'digital-feedback-systems.txt',
      file_path: path.join(__dirname, 'uploads', 'demo-digital-feedback-systems.txt'),
      uploader_id: adminUser.lastID,
      is_protected: 0,
    },
    {
      title: 'Network Optimization for Campus Wi-Fi Access',
      authors: 'L. De Leon, R. Villanueva',
      year: 2024,
      abstract: 'An analysis of wireless access optimization, load balancing and campus network reliability for high-density learning spaces.',
      category_id: 4,
      course: 'Networking',
      department: 'College of Engineering',
      file_name: 'network-optimization-campus-wifi.txt',
      file_path: path.join(__dirname, 'uploads', 'demo-network-optimization-campus-wifi.txt'),
      uploader_id: adminUser.lastID,
      is_protected: 0,
    },
  ];

  for (const doc of docs) {
    await runQuery(
      `INSERT INTO documents (title, authors, year, abstract, category_id, course, department, file_name, file_path, uploader_id, is_protected, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        doc.title,
        doc.authors,
        doc.year,
        doc.abstract,
        doc.category_id,
        doc.course,
        doc.department,
        doc.file_name,
        doc.file_path,
        doc.uploader_id,
        doc.is_protected,
      ]
    );
  }

  const sampleFiles = {
    'demo-ai-learning-analytics.txt': 'AI-Driven Learning Analytics in Higher Education\n\nThis demonstration document summarizes an educational research study on AI-powered learning analytics. It explores student engagement signals, dashboard design and advising interventions.\n\nFindings suggest that timely intervention reduces dropout risk and improves academic performance when teachers receive actionable learner insights.',
    'demo-secure-mobile-banking.txt': 'Secure Mobile Banking Systems with Multi-Factor Authentication\n\nThis sample document addresses digital trust, secure login patterns and layered protection for financial services. The study reviews MFA, risk-based detection and session security procedures.\n\nThe research concludes that layered authentication reduces fraudulent access while preserving usability.',
    'demo-digital-feedback-systems.txt': 'Improving Student Retention Through Digital Feedback Systems\n\nThis demonstration paper compares online feedback systems, intervention timing and digital support workflows. It highlights the value of immediate guidance in raising retention and course completion rates.\n\nThe document suggests that learning dashboards improve student motivation when paired with meaningful teacher feedback.',
    'demo-network-optimization-campus-wifi.txt': 'Network Optimization for Campus Wi-Fi Access\n\nThis file summarizes a study on network performance, bandwidth allocation and device density across campus learning spaces. It emphasizes load balancing, monitoring and structured network segmentation.\n\nThe findings point to better reliability and lower latency for online learning environments.',
  };

  for (const [filename, content] of Object.entries(sampleFiles)) {
    const fullPath = path.join(__dirname, 'uploads', filename);
    if (!fs.existsSync(fullPath)) {
      fs.writeFileSync(fullPath, content, 'utf8');
    }
  }
}

export async function ensureSeedFiles() {
  const uploadsDir = path.join(__dirname, 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });
}

await ensureSeedFiles();
