import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'database.sqlite');
const database = new sqlite3.Database(dbPath);

export function getDatabase() {
  return database;
}

export function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    database.run(sql, params, function (err) {
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
    database.all(sql, params, (err, rows) => {
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
    database.get(sql, params, (err, row) => {
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

  await runQuery('CREATE INDEX IF NOT EXISTS idx_documents_title ON documents(title);');
  await runQuery('CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category_id);');
  await runQuery('CREATE INDEX IF NOT EXISTS idx_documents_department ON documents(department);');
}

export async function seedDatabase() {
  const adminExists = await fetchOne('SELECT id FROM users WHERE username = ?', ['admin']);
  if (adminExists) return;

  const adminHash = await bcrypt.hash('Admin123!', 10);
  const facultyHash = await bcrypt.hash('Faculty123!', 10);
  const studentHash = await bcrypt.hash('Student123!', 10);

  await runQuery(`
    INSERT INTO categories (name, description, created_at) VALUES
      ('AI & Data Science', 'Artificial intelligence and data-driven research.', CURRENT_TIMESTAMP),
      ('Cybersecurity', 'Study of secure systems and digital trust.', CURRENT_TIMESTAMP),
      ('Education Technology', 'Learning technology and academic support systems.', CURRENT_TIMESTAMP),
      ('Systems & Networks', 'Infrastructure and network optimization research.', CURRENT_TIMESTAMP);
  `);

  await runQuery(`
    INSERT INTO users (name, username, email, password_hash, role, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'admin', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    ['System Administrator', 'admin', 'admin@sti.edu', adminHash]);

  await runQuery(`
    INSERT INTO users (name, username, email, password_hash, role, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'faculty', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    ['Faculty Member', 'faculty', 'faculty@sti.edu', facultyHash]);

  await runQuery(`
    INSERT INTO users (name, username, email, password_hash, role, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'student', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    ['Student User', 'student', 'student@sti.edu', studentHash]);

  const sampleDocs = [
    {
      title: 'AI-Driven Learning Analytics in Higher Education',
      authors: 'R. Santos, M. Aquino',
      year: 2024,
      abstract: 'This study evaluates engagement patterns and academic outcomes in digital learning environments using AI-powered analytics and adaptive feedback.',
      category_id: 1,
      course: 'Information Technology',
      department: 'College of Computing Studies',
      uploader_id: 1,
      is_protected: 0,
    },
    {
      title: 'Secure Mobile Banking Systems with Multi-Factor Authentication',
      authors: 'A. Reyes, J. Dela Cruz',
      year: 2023,
      abstract: 'The paper explores secure authentication design and transaction monitoring for mobile financial applications.',
      category_id: 2,
      course: 'Computer Security',
      department: 'College of Computing Studies',
      uploader_id: 1,
      is_protected: 1,
    },
    {
      title: 'Improving Student Retention Through Digital Feedback Systems',
      authors: 'P. Manalo, C. Garcia',
      year: 2022,
      abstract: 'A study on how digital feedback and learner dashboards affect retention and course completion.',
      category_id: 3,
      course: 'Education Technology',
      department: 'School of Teacher Education',
      uploader_id: 2,
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
      uploader_id: 2,
      is_protected: 0,
    },
  ];

  for (const doc of sampleDocs) {
    await runQuery(`
      INSERT INTO documents (title, authors, year, abstract, category_id, course, department, file_name, file_path, uploader_id, is_protected, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      doc.title,
      doc.authors,
      doc.year,
      doc.abstract,
      doc.category_id,
      doc.course,
      doc.department,
      `${doc.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.txt`,
      path.join(__dirname, 'uploads', `${doc.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.txt`),
      doc.uploader_id,
      doc.is_protected,
    ]);
  }

  const uploadsDir = path.join(__dirname, 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });

  const sampleFileContents = {
    'ai-driven-learning-analytics-in-higher-education.txt': 'AI-Driven Learning Analytics in Higher Education\n\nThis demonstration paper explores AI-powered learning analytics in university settings. It studies student engagement patterns and how institutions use dashboards to anticipate academic risk and support intervention.\n\nThe findings show that timely action reduces dropout risk and improves learning outcomes.',
    'secure-mobile-banking-systems-with-multi-factor-authentication.txt': 'Secure Mobile Banking Systems with Multi-Factor Authentication\n\nThis sample paper details digital trust concerns in mobile financial services. It reviews layered authentication, transaction verification and secure session management.\n\nThe study stresses that secure user experience is essential for maintaining customer confidence.',
    'improving-student-retention-through-digital-feedback-systems.txt': 'Improving Student Retention Through Digital Feedback Systems\n\nThe paper discusses digital feedback loops and their influence on learner retention. It examines how timely teacher response, dashboards and intervention workflows improve course completion and perceived support.\n\nResults show that structured feedback contributes to stronger student engagement.',
    'network-optimization-for-campus-wi-fi-access.txt': 'Network Optimization for Campus Wi-Fi Access\n\nThis research investigates campus wireless reliability in high-density locations. It focuses on load balancing, device congestion, and network segmentation to improve performance.\n\nThe findings provide a practical framework for stable online learning experiences.'
  };

  for (const [name, content] of Object.entries(sampleFileContents)) {
    const fullPath = path.join(uploadsDir, name);
    if (!fs.existsSync(fullPath)) {
      fs.writeFileSync(fullPath, content, 'utf8');
    }
  }
}

await initDatabase();
await seedDatabase();
