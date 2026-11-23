import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import argon2 from 'argon2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Guarantees consistent persistent disk storage at server/data/gnbvg.db
const DATA_DIR = path.resolve(__dirname, '..', '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const DB_PATH = path.join(DATA_DIR, 'gnbvg.db');

export const db = new DatabaseSync(DB_PATH);

// Initialize SQLite schema and default seed data
export async function initSqliteDatabase(): Promise<void> {
  // Optimize SQLite performance and durability with WAL
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  // 1. Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      roll_number TEXT UNIQUE,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('student', 'warden', 'admin')),
      year TEXT CHECK(year IN ('1', '2', '3', '4', NULL)),
      block TEXT,
      room_number TEXT,
      branch TEXT,
      student_phone TEXT,
      father_phone TEXT,
      mother_phone TEXT,
      hostel_id TEXT,
      is_activated INTEGER NOT NULL DEFAULT 0,
      face_enrolled INTEGER NOT NULL DEFAULT 0,
      face_descriptor TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migrate columns if table already existed prior
  const userColumns = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
  const colNames = userColumns.map((c) => c.name);
  if (!colNames.includes('branch')) db.exec('ALTER TABLE users ADD COLUMN branch TEXT;');
  if (!colNames.includes('student_phone')) db.exec('ALTER TABLE users ADD COLUMN student_phone TEXT;');
  if (!colNames.includes('father_phone')) db.exec('ALTER TABLE users ADD COLUMN father_phone TEXT;');
  if (!colNames.includes('mother_phone')) db.exec('ALTER TABLE users ADD COLUMN mother_phone TEXT;');
  if (!colNames.includes('hostel_id')) db.exec('ALTER TABLE users ADD COLUMN hostel_id TEXT;');
  if (!colNames.includes('is_activated')) db.exec('ALTER TABLE users ADD COLUMN is_activated INTEGER NOT NULL DEFAULT 0;');

  // 2. Attendance table
  db.exec(`
    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      roll_number TEXT NOT NULL,
      name TEXT NOT NULL,
      year TEXT NOT NULL,
      block TEXT NOT NULL,
      room_number TEXT NOT NULL,
      date TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'Present',
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Index for date and student lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
    CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance(student_id);
    CREATE INDEX IF NOT EXISTS idx_attendance_date_student ON attendance(date, student_id);
  `);

  // 3. Hostel Blocks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS hostel_blocks (
      block_name TEXT PRIMARY KEY,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      radius_meters REAL NOT NULL
    );
  `);

  // Seed default hostel blocks if not already seeded
  const existingBlocksStmt = db.prepare('SELECT COUNT(*) as count FROM hostel_blocks');
  const blocksCount = (existingBlocksStmt.get() as { count: number }).count;

  if (blocksCount === 0) {
    const insertBlock = db.prepare(`
      INSERT INTO hostel_blocks (block_name, latitude, longitude, radius_meters)
      VALUES (?, ?, ?, ?)
    `);

    // GPREC Kurnool Campus Approximate Coordinates
    insertBlock.run('Anapurna-A', 15.8344, 78.0352, 150.0);
    insertBlock.run('Arundhathi-B', 15.8348, 78.0355, 150.0);
    insertBlock.run('Anuradha-C', 15.8340, 78.0350, 150.0);

    console.log('[SQLITE INIT] Seeded default hostel blocks: Anapurna-A, Arundhathi-B, Anuradha-C');
  }

  // Seed default Warden accounts (warden@gprec.ac.in & warden.gnbvg@gprec.ac.in)
  const defaultPasswordHash = await argon2.hash('Warden@123', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const insertUser = db.prepare(`
    INSERT OR REPLACE INTO users (id, name, roll_number, email, password_hash, role, year, block, room_number, is_activated, face_enrolled, face_descriptor)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const warden1 = db.prepare('SELECT id FROM users WHERE email = ?').get('warden@gprec.ac.in');
  if (!warden1) {
    insertUser.run('usr-warden-001', 'Chief Hostel Warden', 'WARDEN-001', 'warden@gprec.ac.in', defaultPasswordHash, 'warden', null, 'Anapurna-A', 'W-OFFICE', 1, 0, null);
    console.log('[SQLITE INIT] Seeded default Warden: warden@gprec.ac.in / Warden@123');
  }

  const warden2 = db.prepare('SELECT id FROM users WHERE email = ?').get('warden.gnbvg@gprec.ac.in');
  if (!warden2) {
    insertUser.run('usr-warden-002', 'Chief Hostel Warden', 'WARDEN-002', 'warden.gnbvg@gprec.ac.in', defaultPasswordHash, 'warden', null, 'Arundhathi-B', 'W-OFFICE-2', 1, 0, null);
    console.log('[SQLITE INIT] Seeded default Warden: warden.gnbvg@gprec.ac.in / Warden@123');
  }

  const admin1 = db.prepare('SELECT id FROM users WHERE email = ?').get('admin.hostel@gprec.ac.in');
  if (!admin1) {
    insertUser.run('usr-admin-001', 'Hostel Super Administrator', 'ADMIN-001', 'admin.hostel@gprec.ac.in', defaultPasswordHash, 'admin', null, 'Anuradha-C', 'ADMIN-01', 1, 0, null);
    console.log('[SQLITE INIT] Seeded default Admin: admin.hostel@gprec.ac.in / Warden@123');
  }

  const admin2 = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@gprec.ac.in');
  if (!admin2) {
    insertUser.run('usr-admin-002', 'Hostel Super Administrator', 'ADMIN-002', 'admin@gprec.ac.in', defaultPasswordHash, 'admin', null, 'Anuradha-C', 'ADMIN-02', 1, 0, null);
    console.log('[SQLITE INIT] Seeded default Admin: admin@gprec.ac.in / Warden@123');
  }

  const studentDemo = db.prepare('SELECT id FROM users WHERE email = ?').get('219x1a0501@gprec.ac.in');
  if (!studentDemo) {
    insertUser.run('usr-student-demo', 'Demo Student Resident', '219X1A0501', '219x1a0501@gprec.ac.in', defaultPasswordHash, 'student', '3', 'Arundhathi-B', 'BO-101', 1, 0, null);
    console.log('[SQLITE INIT] Seeded demo Student: 219x1a0501@gprec.ac.in / Warden@123');
  }
}
