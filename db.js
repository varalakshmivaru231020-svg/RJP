const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'rjp',
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true
});

// Thin helpers matching the shape of the previous better-sqlite3 API
// (db.get/.all/.run instead of db.prepare(sql).get()/.all()/.run()) so call
// sites stay readable — mysql2 itself only exposes .query()/.execute().
pool.get = async (sql, params) => {
  const [rows] = await pool.query(sql, params);
  return rows[0];
};
pool.all = async (sql, params) => {
  const [rows] = await pool.query(sql, params);
  return rows;
};
pool.run = async (sql, params) => {
  const [result] = await pool.query(sql, params);
  return result;
};

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    application_number VARCHAR(30) UNIQUE NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    guardian_name VARCHAR(150),
    dob DATE NULL,
    gender VARCHAR(20),
    mobile VARCHAR(15) UNIQUE NOT NULL,
    whatsapp VARCHAR(15),
    email VARCHAR(150),
    aadhaar VARCHAR(20),
    address TEXT,
    state VARCHAR(100),
    district VARCHAR(100),
    taluk VARCHAR(100),
    assembly VARCHAR(150),
    parliament VARCHAR(150),
    ward VARCHAR(100),
    booth VARCHAR(100),
    occupation VARCHAR(100),
    education VARCHAR(150),
    religion VARCHAR(100),
    caste VARCHAR(100),
    sub_caste VARCHAR(100),
    areas_of_interest TEXT,
    social_media VARCHAR(255),
    photo_path VARCHAR(255),
    id_upload_path VARCHAR(255),
    declaration_accepted TINYINT(1) NOT NULL DEFAULT 0,
    password_hash VARCHAR(255) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'Pending Approval',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150),
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS member_activity (
    id INT AUTO_INCREMENT PRIMARY KEY,
    member_id INT NOT NULL,
    action VARCHAR(50) NOT NULL,
    note TEXT,
    admin_email VARCHAR(150),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_activity_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    value TEXT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS cms_content (
    section VARCHAR(50) PRIMARY KEY,
    data LONGTEXT NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
];

const DEFAULT_ADMIN_EMAIL = 'admin@rjp.local';
const DEFAULT_ADMIN_PASSWORD = 'Admin@123';

async function ensureColumn(table, column, definition) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  if (rows[0].n === 0) {
    await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

async function init() {
  for (const statement of SCHEMA) {
    await pool.query(statement);
  }

  await ensureColumn('members', 'payment_status', "VARCHAR(20) NOT NULL DEFAULT 'Not Paid'");
  await ensureColumn('members', 'payment_proof_path', 'VARCHAR(255)');
  await ensureColumn('members', 'payment_submitted_at', 'DATETIME NULL');

  const adminCount = await pool.get('SELECT COUNT(*) AS n FROM admins');
  if (adminCount.n === 0) {
    await pool.run('INSERT INTO admins (name, email, password_hash) VALUES (?, ?, ?)', [
      'Super Admin',
      DEFAULT_ADMIN_EMAIL,
      bcrypt.hashSync(DEFAULT_ADMIN_PASSWORD, 10)
    ]);
    console.log('----------------------------------------------------');
    console.log('Created default admin account (change this password!):');
    console.log(`  Email:    ${DEFAULT_ADMIN_EMAIL}`);
    console.log(`  Password: ${DEFAULT_ADMIN_PASSWORD}`);
    console.log('----------------------------------------------------');
  }
}

pool.init = init;
module.exports = pool;
