const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'rjp.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_number TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    guardian_name TEXT,
    dob TEXT,
    gender TEXT,
    mobile TEXT UNIQUE NOT NULL,
    whatsapp TEXT,
    email TEXT,
    aadhaar TEXT,
    address TEXT,
    state TEXT,
    district TEXT,
    taluk TEXT,
    assembly TEXT,
    parliament TEXT,
    ward TEXT,
    booth TEXT,
    occupation TEXT,
    education TEXT,
    religion TEXT,
    caste TEXT,
    sub_caste TEXT,
    areas_of_interest TEXT,
    social_media TEXT,
    photo_path TEXT,
    id_upload_path TEXT,
    declaration_accepted INTEGER NOT NULL DEFAULT 0,
    password_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending Approval',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS member_activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    note TEXT,
    admin_email TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS cms_content (
    section TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const DEFAULT_ADMIN_EMAIL = 'admin@rjp.local';
const DEFAULT_ADMIN_PASSWORD = 'Admin@123';

const adminCount = db.prepare('SELECT COUNT(*) AS n FROM admins').get().n;
if (adminCount === 0) {
  db.prepare('INSERT INTO admins (name, email, password_hash) VALUES (?, ?, ?)').run(
    'Super Admin',
    DEFAULT_ADMIN_EMAIL,
    bcrypt.hashSync(DEFAULT_ADMIN_PASSWORD, 10)
  );
  console.log('----------------------------------------------------');
  console.log('Created default admin account (change this password!):');
  console.log(`  Email:    ${DEFAULT_ADMIN_EMAIL}`);
  console.log(`  Password: ${DEFAULT_ADMIN_PASSWORD}`);
  console.log('----------------------------------------------------');
}

module.exports = db;
