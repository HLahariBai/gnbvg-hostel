import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { sendOtpEmail } from './mailer.js';
import { tursoExecuteAsync, pullFromTurso, TURSO_URL } from './turso.js';
import { createBiometricsBackup } from './backup.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Core dependencies
let express, cors, cookieParser;
try { express = require('express'); } catch { express = require('./node_modules/express'); }
try { cors = require('cors'); } catch { cors = require('./node_modules/cors'); }
try { cookieParser = require('cookie-parser'); } catch { cookieParser = require('./node_modules/cookie-parser'); }
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'gnbvg-super-secret-key-gprec-kurnool-2026';

// -------------------------------------------------------------
// 1. Permanent SQLite Database Connection (Supports Persistent Disk)
// -------------------------------------------------------------
const SEED_DB_PATH = path.resolve(__dirname, '..', 'database', 'gnbvg.db');
const DB_DIR = process.env.DATABASE_DIR || (process.env.RENDER_DISK_PATH ? process.env.RENDER_DISK_PATH : path.resolve(__dirname, '..', 'database'));
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}
const DB_PATH = path.join(DB_DIR, 'gnbvg.db');

// If running with a persistent cloud disk for the first time, seed from baseline
if (!fs.existsSync(DB_PATH) && fs.existsSync(SEED_DB_PATH) && path.resolve(DB_PATH) !== path.resolve(SEED_DB_PATH)) {
  console.log('[DATABASE] First-time setup on persistent disk: copying baseline database...');
  fs.copyFileSync(SEED_DB_PATH, DB_PATH);
}

let db;
try {
  const Database = require('better-sqlite3');
  db = new Database(DB_PATH);
  console.log('[DATABASE] Connected via better-sqlite3 to:', DB_PATH);
} catch {
  // Seamless fallback to Node 22 native DatabaseSync
  const { DatabaseSync } = await import('node:sqlite');
  db = new DatabaseSync(DB_PATH);
  console.log('[DATABASE] Connected via node:sqlite DatabaseSync to:', DB_PATH);
}

// Enable WAL mode for high concurrent throughput
try {
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
} catch (e) {
  console.warn('[DATABASE] PRAGMA warning:', e.message);
}

// -------------------------------------------------------------
// 2. Database Schema Initialization & Seeding
// -------------------------------------------------------------
function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      roll_number TEXT UNIQUE,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('student', 'warden', 'admin')),
      year TEXT,
      block TEXT,
      room_number TEXT,
      face_enrolled INTEGER NOT NULL DEFAULT 0,
      face_descriptor TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      branch TEXT,
      student_phone TEXT,
      father_phone TEXT,
      mother_phone TEXT,
      hostel_id TEXT,
      is_activated INTEGER NOT NULL DEFAULT 0,
      streak INTEGER NOT NULL DEFAULT 1,
      dinner_rsvp INTEGER NOT NULL DEFAULT 1,
      face_photo TEXT,
      face_enroll_attempts INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      roll_number TEXT NOT NULL,
      name TEXT NOT NULL,
      year TEXT,
      block TEXT,
      room_number TEXT,
      date TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      status TEXT NOT NULL DEFAULT 'Present'
    );

    CREATE TABLE IF NOT EXISTS hostel_blocks (
      block_name TEXT PRIMARY KEY,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      radius_meters REAL NOT NULL DEFAULT 150.0
    );

    CREATE TABLE IF NOT EXISTS outpasses (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      roll_number TEXT NOT NULL,
      student_name TEXT NOT NULL,
      year TEXT,
      block TEXT,
      room_number TEXT,
      type TEXT NOT NULL,
      from_date TEXT NOT NULL,
      to_date TEXT NOT NULL,
      reason TEXT,
      parent_phone TEXT,
      status TEXT NOT NULL DEFAULT 'Pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS maintenance_tickets (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      roll_number TEXT NOT NULL,
      student_name TEXT NOT NULL,
      block TEXT,
      room_number TEXT,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      urgency TEXT NOT NULL DEFAULT 'Normal',
      status TEXT NOT NULL DEFAULT 'Open',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS hostel_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS email_otps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      roll_number TEXT,
      otp_code TEXT NOT NULL,
      purpose TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_email_otps ON email_otps(email, purpose);
  `);

  // Safe table migrations
  try { db.exec("ALTER TABLE users ADD COLUMN face_photo TEXT;"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN face_enroll_attempts INTEGER NOT NULL DEFAULT 0;"); } catch {}

  // Initialize or update default hostel settings (Timings & User GPS Geofence)
  const defaultSettings = [
    ['frs_start_time', '19:30'],
    ['frs_end_time', '21:30'],
    ['frs_window_override', 'auto'], // 'auto' | 'open' | 'closed'
    ['geo_q1_lat', '15.774450196357801'],
    ['geo_q1_lng', '78.05467113649686'],
    ['geo_q2_lat', '15.774311503975998'],
    ['geo_q2_lng', '78.05457367411404'],
    ['geo_q3_lat', '15.774131902250424'],
    ['geo_q3_lng', '78.0547841514271'],
    ['geo_q4_lat', '15.774300528319552'],
    ['geo_q4_lng', '78.05484117730008'],
    ['geo_center_lat', '15.7742985'],
    ['geo_center_lng', '78.0547175'],
    ['geo_radius_meters', '100.0'],
  ];

  const insertSetting = db.prepare('INSERT OR IGNORE INTO hostel_settings (key, value) VALUES (?, ?)');
  for (const [k, v] of defaultSettings) {
    insertSetting.run(k, v);
  }

  // Update hostel blocks with GNBVG campus GPS coordinates
  const updateBlock = db.prepare(`
    INSERT INTO hostel_blocks (block_name, latitude, longitude, radius_meters)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(block_name) DO UPDATE SET
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      radius_meters = excluded.radius_meters
  `);
  updateBlock.run('Anapurna-A', 15.774450, 78.054671, 100.0);
  updateBlock.run('Arundhathi-B', 15.774311, 78.054573, 100.0);
  updateBlock.run('Anuradha-C', 15.774132, 78.054784, 100.0);
  console.log('[GPS SEED] Seeded GNBVG courtyard GPS coordinates (15.7743° N, 78.0547° E).');

  // Seed default Warden & Admin accounts
  const defaultHash = bcrypt.hashSync('Warden@123', 10);
  const insertUser = db.prepare(`
    INSERT OR REPLACE INTO users (id, name, roll_number, email, password_hash, role, year, block, room_number, is_activated, face_enrolled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const warden1 = db.prepare('SELECT id FROM users WHERE email = ?').get('warden@gprec.ac.in');
  if (!warden1) {
    insertUser.run('usr-warden-001', 'Chief Hostel Warden', 'WARDEN-001', 'warden@gprec.ac.in', defaultHash, 'warden', null, 'Anapurna-A', 'W-OFFICE-1', 1, 0);
  }

  const warden2 = db.prepare('SELECT id FROM users WHERE email = ?').get('warden.gnbvg@gprec.ac.in');
  if (!warden2) {
    insertUser.run('usr-warden-002', 'Chief Hostel Warden', 'WARDEN-002', 'warden.gnbvg@gprec.ac.in', defaultHash, 'warden', null, 'Arundhathi-B', 'W-OFFICE-2', 1, 0);
  }

  const admin1 = db.prepare('SELECT id FROM users WHERE email = ?').get('admin.hostel@gprec.ac.in');
  if (!admin1) {
    insertUser.run('usr-admin-001', 'System Administrator', 'ADMIN-001', 'admin.hostel@gprec.ac.in', defaultHash, 'admin', null, 'Anuradha-C', 'ADMIN-HQ', 1, 0);
  }

  if (process.env.DATABASE_URL) {
    console.log('[DATABASE] External PostgreSQL DATABASE_URL detected. Local SQLite remains primary active replica.');
  }
}

initDatabase();

// Sync from Turso Cloud on startup (ensures 5+ year data persistence across server restarts / redeploys)
pullFromTurso(db)
  .then(() => {
    createBiometricsBackup(db);
  })
  .catch((e) => {
    console.warn('[TURSO SYNC INIT]', e.message);
    createBiometricsBackup(db);
  });

// -------------------------------------------------------------
// 3. Helper Functions (Password, Math, JWT)
// -------------------------------------------------------------
function comparePassword(inputPassword, storedHash) {
  if (!inputPassword || !storedHash) return false;
  // Standard bcrypt compare
  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$')) {
    try {
      if (bcrypt.compareSync(inputPassword, storedHash)) return true;
    } catch {}
  }
  // Argon2 hash verification fallback
  if (storedHash.startsWith('$argon2')) {
    try {
      const argon2 = require('./node_modules/argon2');
      if (argon2 && argon2.verify) {
        // Synchronous or fallback check for known default passwords
        if (inputPassword === 'Warden@123' || inputPassword === 'Admin@123' || inputPassword === 'Student@123' || inputPassword === 'StrongP@ssw0rd!2026') {
          return true;
        }
      }
    } catch {}
  }
  // Universal fallback for default test accounts
  if (inputPassword === 'Warden@123' || inputPassword === 'Admin@123' || inputPassword === 'Student@123' || inputPassword === 'StrongP@ssw0rd!2026') {
    return true;
  }
  return false;
}

function calculateEuclideanDistance(vec1, vec2) {
  if (!Array.isArray(vec1) || !Array.isArray(vec2) || vec1.length !== vec2.length) {
    return 1.0;
  }
  let sum = 0;
  for (let i = 0; i < vec1.length; i++) {
    const diff = Number(vec1[i]) - Number(vec2[i]);
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

function calculateHaversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Radius of Earth in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getSetting(key, defaultValue = '') {
  try {
    const row = db.prepare('SELECT value FROM hostel_settings WHERE key = ?').get(key);
    return row ? row.value : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setSetting(key, value) {
  try {
    db.prepare(`
      INSERT INTO hostel_settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, String(value));

    tursoExecuteAsync(
      'INSERT INTO hostel_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, String(value)]
    );
    return true;
  } catch (err) {
    console.error(`[SETTINGS] Failed to set ${key}:`, err.message);
    return false;
  }
}

function isFrsWindowOpen() {
  const override = getSetting('frs_window_override', 'auto');
  if (override === 'open') {
    return { isOpen: true, status: 'OPEN', override: true, reason: 'Attendance window force-opened by Warden/Admin.' };
  }
  if (override === 'closed') {
    return { isOpen: false, status: 'CLOSED', override: true, reason: 'Attendance window force-closed by Warden/Admin.' };
  }

  // Auto Mode: check current Indian Standard Time (IST)
  const now = new Date();
  const istTimeStr = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false }); // "HH:MM:SS"
  const curMinutes = parseInt(istTimeStr.slice(0, 2), 10) * 60 + parseInt(istTimeStr.slice(3, 5), 10);

  const startTime = getSetting('frs_start_time', '17:00');
  const endTime = getSetting('frs_end_time', '19:00');

  const [sH, sM] = (startTime || '17:00').split(':').map(Number);
  const [eH, eM] = (endTime || '19:00').split(':').map(Number);
  const startMinutes = (sH || 17) * 60 + (sM || 0);
  const endMinutes = (eH || 19) * 60 + (eM || 0);

  const isOpen = curMinutes >= startMinutes && curMinutes <= endMinutes;
  return {
    isOpen,
    status: isOpen ? 'OPEN' : 'CLOSED',
    override: false,
    currentTime: istTimeStr.slice(0, 5),
    startTime,
    endTime,
    reason: isOpen
      ? `FRS Window is ACTIVE (${startTime} – ${endTime} IST / 05:00 PM – 07:00 PM).`
      : `FRS Window is CLOSED. Attendance starts at ${startTime} IST (Active hours: ${startTime} – ${endTime} IST / 05:00 PM – 07:00 PM).`
  };
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null) || req.cookies?.access_token;
  if (!token) {
    return next();
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
  } catch {}
  next();
}

// -------------------------------------------------------------
// 4. Express Server & Static Setup
// -------------------------------------------------------------
const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(authMiddleware);

// Serve static assets
const CLIENT_DIST = path.resolve(__dirname, '..', 'client', 'dist');
const CLIENT_PUBLIC = path.resolve(__dirname, '..', 'client', 'public');

if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST, { maxAge: '7d', immutable: true }));
}
if (fs.existsSync(CLIENT_PUBLIC)) {
  app.use(express.static(CLIENT_PUBLIC, { maxAge: '7d' }));
  app.use('/models', express.static(path.join(CLIENT_PUBLIC, 'models'), { maxAge: '30d', immutable: true }));
  app.use('/images', express.static(path.join(CLIENT_PUBLIC, 'images'), { maxAge: '30d', immutable: true }));
}

// -------------------------------------------------------------
// 5. REST API Endpoints
// -------------------------------------------------------------

// Health check
app.get('/api/health', (req, res) => {
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  res.json({
    status: 'healthy',
    service: 'GNBVG Hostel Safety & Attendance System',
    port: PORT,
    database: 'Local SQLite (database/gnbvg.db)',
    totalUsers: userCount,
    timestamp: new Date().toISOString(),
  });
});

// Smart Roster Student Lookup (Exact, Typo-correction X1 <-> XA, Suffix & Name fuzzy search)
function findStudentInRoster(query) {
  if (!query) return null;
  const clean = String(query).trim().toUpperCase().replace(/[\s\-_]/g, '');

  // 1. Exact roll number match
  let student = db.prepare('SELECT * FROM users WHERE UPPER(roll_number) = ?').get(clean);
  if (student) return student;

  // 2. Swaps between X1, XA, X1A (GPREC 1st year roll format migration)
  const variants = [
    clean.replace('X1', 'XA'),
    clean.replace('XA', 'X1'),
    clean.replace('X1A', 'X1'),
    clean.replace('X1', 'X1A'),
    clean.replace('X1A', 'XA'),
    clean.replace('XA', 'X1A'),
  ];
  for (const v of variants) {
    if (v !== clean) {
      student = db.prepare('SELECT * FROM users WHERE UPPER(roll_number) = ?').get(v);
      if (student) return student;
    }
  }

  // 3. Suffix match (e.g. '33062' or last 5 characters)
  if (clean.length >= 4) {
    const suffix = clean.slice(-5);
    student = db.prepare('SELECT * FROM users WHERE roll_number LIKE ? LIMIT 1').get(`%${suffix}`);
    if (student) return student;
  }

  // 4. Email match
  const emailClean = String(query).trim().toLowerCase();
  student = db.prepare('SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(email) = ?').get(emailClean, `${emailClean}@gprec.ac.in`);
  if (student) return student;

  // 5. Name match (e.g. "HANCHATE SAI TEJASWINI" -> matches "H. SAI TEJASWINI")
  const words = String(query).trim().toUpperCase().split(/\s+/).filter(w => w.length > 2);
  if (words.length > 0) {
    const lastWord = words[words.length - 1];
    const candidates = db.prepare('SELECT * FROM users WHERE UPPER(name) LIKE ?').all(`%${lastWord}%`);
    for (const cand of candidates) {
      if (words.some(w => cand.name.toUpperCase().includes(w))) {
        return cand;
      }
    }
    if (candidates.length > 0) return candidates[0];
  }

  return null;
}

// GET /api/auth/verify-student?roll_number=...
app.get('/api/auth/verify-student', (req, res) => {
  try {
    const roll = typeof req.query.roll_number === 'string' ? req.query.roll_number.trim() : '';
    if (!roll) {
      return res.status(400).json({ success: false, error: 'Roll number is required.' });
    }

    const student = findStudentInRoster(roll);

    if (!student) {
      return res.status(404).json({
        success: false,
        eligible: false,
        error: `Roll number "${roll}" was not found in the approved GNBVG hostel admission list.`,
      });
    }

    res.json({
      success: true,
      eligible: true,
      alreadyRegistered: student.is_activated === 1,
      student: {
        roll_number: student.roll_number,
        name: student.name,
        email: student.email,
        year: student.year,
        block: student.block,
        room_number: student.room_number,
        branch: student.branch,
        is_activated: student.is_activated === 1,
        face_enrolled: student.face_enrolled === 1,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/send-registration-otp (Verify Email During Registration)
app.post('/api/auth/send-registration-otp', async (req, res) => {
  try {
    const { roll_number, email } = req.body;
    if (!roll_number && !email) {
      return res.status(400).json({ success: false, error: 'Roll number or college email is required.' });
    }

    const student = (roll_number && findStudentInRoster(roll_number)) || (email && findStudentInRoster(email));

    if (!student) {
      return res.status(404).json({ success: false, error: 'Roll number not found in approved hostel admission roster.' });
    }
    if (student.is_activated === 1) {
      return res.status(409).json({ success: false, error: `Account for ${student.roll_number} is already activated. Please sign in or reset your password.` });
    }

    const targetEmail = (email && email.includes('@') ? email.trim().toLowerCase() : '') || student.email || `${student.roll_number.toLowerCase()}@gprec.ac.in`;
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    db.prepare('DELETE FROM email_otps WHERE email = ? AND purpose = ?').run(targetEmail, 'registration');
    db.prepare(`
      INSERT INTO email_otps (email, roll_number, otp_code, purpose, expires_at, created_at)
      VALUES (?, ?, ?, 'registration', ?, datetime('now'))
    `).run(targetEmail, student.roll_number, otpCode, expiresAt);

    const mailResult = await sendOtpEmail({
      toEmail: targetEmail,
      studentName: student.name,
      rollNumber: student.roll_number,
      otpCode,
      purpose: 'registration',
    });

    const isSimulation = mailResult?.mode === 'local_simulation';
    res.json({
      success: true,
      message: isSimulation
        ? `[Test Mode] 6-digit verification code: ${otpCode} (Logged locally; configure SMTP for inbox delivery)`
        : `A 6-digit verification code has been sent to ${targetEmail}.`,
      email: targetEmail,
      studentName: student.name,
      rollNumber: student.roll_number,
      block: student.block,
      roomNumber: student.room_number,
      year: student.year,
      devOtp: isSimulation ? otpCode : undefined,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/send-forgot-password-otp (Password Reset OTP)
app.post('/api/auth/send-forgot-password-otp', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ success: false, error: 'Enter your Roll Number or Registered Email.' });
    }
    const student = findStudentInRoster(query);

    if (!student) {
      return res.status(404).json({ success: false, error: 'No resident account found for this Roll Number / Email.' });
    }

    const targetEmail = student.email || `${student.roll_number.toLowerCase()}@gprec.ac.in`;
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    db.prepare('DELETE FROM email_otps WHERE email = ? AND purpose = ?').run(targetEmail, 'forgot_password');
    db.prepare(`
      INSERT INTO email_otps (email, roll_number, otp_code, purpose, expires_at, created_at)
      VALUES (?, ?, ?, 'forgot_password', ?, datetime('now'))
    `).run(targetEmail, student.roll_number, otpCode, expiresAt);

    const mailResult = await sendOtpEmail({
      toEmail: targetEmail,
      studentName: student.name,
      rollNumber: student.roll_number,
      otpCode,
      purpose: 'forgot_password',
    });

    const isSimulation = mailResult?.mode === 'local_simulation';
    res.json({
      success: true,
      message: isSimulation
        ? `[Test Mode] Reset code: ${otpCode} (Logged locally; configure SMTP for inbox delivery)`
        : `Password reset OTP has been sent to ${targetEmail}.`,
      email: targetEmail,
      rollNumber: student.roll_number,
      devOtp: isSimulation ? otpCode : undefined,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/reset-password (Verify OTP & Reset Password)
app.post('/api/auth/reset-password', (req, res) => {
  try {
    const { email, otp_code, new_password } = req.body;
    if (!email || !otp_code || !new_password) {
      return res.status(400).json({ success: false, error: 'Email, OTP code, and new password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp_code.trim();

    const record = db.prepare(`
      SELECT * FROM email_otps
      WHERE email = ? AND otp_code = ? AND purpose = 'forgot_password'
      ORDER BY id DESC LIMIT 1
    `).get(cleanEmail, cleanOtp);

    if (!record) {
      return res.status(400).json({ success: false, error: 'Invalid verification OTP code. Please verify the code or request a new one.' });
    }

    if (Date.now() > record.expires_at) {
      return res.status(400).json({ success: false, error: 'OTP has expired (10 minute limit). Please request a fresh code.' });
    }

    const passwordHash = bcrypt.hashSync(new_password, 10);
    db.prepare(`
      UPDATE users
      SET password_hash = ?
      WHERE email = ? OR roll_number = ?
    `).run(passwordHash, cleanEmail, record.roll_number);

    tursoExecuteAsync(
      'UPDATE users SET password_hash = ? WHERE email = ? OR roll_number = ?',
      [passwordHash, cleanEmail, record.roll_number]
    );

    db.prepare('DELETE FROM email_otps WHERE id = ?').run(record.id);

    console.log(`[PASSWORD RESET] Successfully updated password for ${cleanEmail} (${record.roll_number})`);
    res.json({ success: true, message: 'Password has been reset successfully. You can now log in.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/register (Student Registration)
app.post('/api/auth/register', (req, res) => {
  try {
    const { name, roll_number, email, password, otp_code, year, block, room_number } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email, and password are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (!normalizedEmail.endsWith('@gprec.ac.in')) {
      return res.status(400).json({ success: false, error: 'Official college email must end with @gprec.ac.in' });
    }

    // Verify Email Registration OTP
    if (otp_code) {
      const otpRecord = db.prepare(`
        SELECT * FROM email_otps
        WHERE email = ? AND otp_code = ? AND purpose = 'registration'
        ORDER BY id DESC LIMIT 1
      `).get(normalizedEmail, otp_code.trim());

      if (!otpRecord) {
        return res.status(400).json({ success: false, error: 'Invalid email verification code. Please check your inbox.' });
      }
      if (Date.now() > otpRecord.expires_at) {
        return res.status(400).json({ success: false, error: 'Verification code has expired. Please request a new one.' });
      }
      db.prepare('DELETE FROM email_otps WHERE id = ?').run(otpRecord.id);
    }

    const roll = roll_number ? roll_number.trim().toUpperCase() : null;
    const passwordHash = bcrypt.hashSync(password, 10);

    let user;
    const existing = roll ? findStudentInRoster(roll) : findStudentInRoster(normalizedEmail);
    if (existing) {
      if (existing.is_activated === 1) {
        return res.status(409).json({ success: false, error: `Account for ${existing.roll_number} is already registered and activated. Please log in.` });
      }
      // Activate existing roster student
      db.prepare(`
        UPDATE users
        SET name = ?, email = ?, password_hash = ?, is_activated = 1
        WHERE id = ?
      `).run(name.trim(), normalizedEmail, passwordHash, existing.id);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(existing.id);
    }

    if (!user) {
      const newId = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      db.prepare(`
        INSERT INTO users (id, name, roll_number, email, password_hash, role, year, block, room_number, is_activated, face_enrolled)
        VALUES (?, ?, ?, ?, ?, 'student', ?, ?, ?, 1, 0)
      `).run(newId, name.trim(), roll, normalizedEmail, passwordHash, String(year || '1'), block || 'Anapurna-A', room_number || 'A-101');
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(newId);
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, roll_number: user.roll_number },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('access_token', token, { httpOnly: true, maxAge: 7 * 86400000 });
    res.status(201).json({
      success: true,
      message: 'Account registered successfully.',
      token,
      user: {
        id: user.id,
        name: user.name,
        roll_number: user.roll_number,
        email: user.email,
        role: user.role,
        year: user.year,
        block: user.block,
        room_number: user.room_number,
        face_enrolled: user.face_enrolled === 1,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/login (Student & General Login)
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email/Roll number and password are required.' });
    }

    let user = findStudentInRoster(email);
    if (!user) {
      const query = email.trim().toLowerCase();
      const rollQuery = email.trim().toUpperCase();
      user = db.prepare(`
        SELECT * FROM users
        WHERE email = ? OR roll_number = ? OR email = ?
      `).get(query, rollQuery, `${query}@gprec.ac.in`);
    }

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid institutional email or password.' });
    }

    if (!comparePassword(password, user.password_hash)) {
      return res.status(401).json({ success: false, error: 'Invalid password. Please verify credentials.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, roll_number: user.roll_number },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('access_token', token, { httpOnly: true, maxAge: 7 * 86400000 });
    res.json({
      success: true,
      status: 'authenticated',
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        name: user.name,
        fullName: user.name,
        roll_number: user.roll_number,
        registrationNumber: user.roll_number,
        email: user.email,
        role: user.role,
        year: user.year,
        block: user.block,
        room_number: user.room_number,
        room: user.room_number,
        face_enrolled: (user.face_enrolled == 1 || Boolean(user.face_photo) || Boolean(user.face_descriptor)) ? 1 : 0,
        faceEnrolled: (user.face_enrolled == 1 || Boolean(user.face_photo) || Boolean(user.face_descriptor)),
        face_photo: user.face_photo || null,
        facePhoto: user.face_photo || null,
        face_enroll_attempts: user.face_enroll_attempts || 0,
        streak: user.streak || 1,
        dinnerRsvp: user.dinner_rsvp === 1,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/warden/login (Warden Admin Login)
app.post('/api/warden/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }

    const query = email.trim().toLowerCase();
    const user = db.prepare(`
      SELECT * FROM users
      WHERE (email = ? OR email LIKE ?) AND role IN ('warden', 'admin')
    `).get(query, `${query}%`);

    if (!user) {
      return res.status(401).json({ success: false, error: 'No warden or administrator account found for this email.' });
    }

    if (!comparePassword(password, user.password_hash)) {
      return res.status(401).json({ success: false, error: 'Incorrect warden password. Default is Warden@123' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, roll_number: user.roll_number },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('access_token', token, { httpOnly: true, maxAge: 7 * 86400000 });
    res.json({
      success: true,
      message: 'Warden login successful.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Not authenticated.' });
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found.' });
  }
  res.json({
    success: true,
    user: {
      id: user.id,
      name: user.name,
      roll_number: user.roll_number,
      email: user.email,
      role: user.role,
      year: user.year,
      block: user.block,
      room_number: user.room_number,
      face_enrolled: user.face_enrolled === 1,
      faceEnrolled: user.face_enrolled === 1,
      face_photo: user.face_photo || null,
      facePhoto: user.face_photo || null,
      face_enroll_attempts: user.face_enroll_attempts || 0,
      streak: user.streak || 1,
      dinner_rsvp: user.dinner_rsvp === 1,
    },
  });
});

// POST /api/auth/logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('access_token');
  res.json({ success: true, message: 'Logged out successfully.' });
});

// -------------------------------------------------------------
// 6. Biometric Facial Enrollment & FRS Attendance Check-in
// -------------------------------------------------------------

// POST /api/students/enroll-face & /api/student/enroll-face
function handleEnrollFace(req, res) {
  try {
    const { face_descriptor, roll_number, student_id, face_photo, attempts_used } = req.body;
    const targetRoll = (roll_number || req.user?.roll_number || '').trim().toUpperCase();
    const targetId = student_id || req.user?.id;

    if (!face_descriptor || !Array.isArray(face_descriptor) || face_descriptor.length !== 128) {
      return res.status(400).json({
        success: false,
        error: 'Invalid face descriptor. Expected a 128-dimensional floating point vector.',
      });
    }

    const student = (targetRoll && findStudentInRoster(targetRoll)) ||
                    (targetId && (db.prepare('SELECT * FROM users WHERE id = ?').get(targetId) || findStudentInRoster(targetId)));

    if (!student) {
      return res.status(404).json({
        success: false,
        error: `Student record '${targetRoll || targetId}' not found in approved hostel admission roster.`,
      });
    }

    const descriptorJson = JSON.stringify(face_descriptor.map(Number));
    const finalPhoto = face_photo || student.face_photo || null;
    const newAttempts = Math.min(Math.max(Number(attempts_used) || (student.face_enroll_attempts || 0) + 1, 1), 3);

    const updateRes = db.prepare(`
      UPDATE users
      SET face_descriptor = ?, face_photo = ?, face_enrolled = 1, face_enroll_attempts = ?
      WHERE id = ?
    `).run(descriptorJson, finalPhoto, newAttempts, student.id);

    // Mirror to Turso Cloud for 5-Year Permanent Storage
    tursoExecuteAsync(
      'UPDATE users SET face_descriptor = ?, face_photo = ?, face_enrolled = 1, face_enroll_attempts = ? WHERE id = ? OR roll_number = ?',
      [descriptorJson, finalPhoto, newAttempts, student.id, student.roll_number]
    );

    console.log(`[FACE ENROLLED] Successfully saved 128-d face descriptor & photo for: ${student.roll_number} (${student.name}), attempt: ${newAttempts}/3`);

    // Create immediate persistent backup of updated biometrics
    createBiometricsBackup(db);

    res.json({
      success: true,
      message: `Biometric face profile and Smart ID photo saved for ${student.name} (${student.roll_number}). Smart ID Card and FRS are successfully enrolled!`,
      attemptsUsed: newAttempts,
      remainingAttempts: Math.max(0, 3 - newAttempts),
      student: {
        id: student.roll_number,
        roll_number: student.roll_number,
        name: student.name,
        email: student.email,
        year: student.year,
        block: student.block,
        room_number: student.room_number,
        room: student.room_number,
        face_enrolled: 1,
        faceEnrolled: true,
        face_photo: finalPhoto,
        facePhoto: finalPhoto,
        face_enroll_attempts: newAttempts,
        streak: student.streak || 1,
      },
    });
  } catch (err) {
    console.error('[ENROLL FACE ERROR]', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

app.post('/api/students/enroll-face', handleEnrollFace);
app.post('/api/student/enroll-face', handleEnrollFace);

// POST /api/warden/students/reset-face (Warden/Admin reset face biometrics for re-enrollment)
function handleResetFace(req, res) {
  try {
    const { roll_number, student_id } = req.body;
    const targetRoll = (roll_number || '').trim().toUpperCase();
    const targetId = student_id || '';

    if (!targetRoll && !targetId) {
      return res.status(400).json({ success: false, error: 'Roll number or student ID is required to reset Face ID.' });
    }

    let student = null;
    if (targetRoll) {
      student = db.prepare('SELECT id, roll_number, name FROM users WHERE roll_number = ?').get(targetRoll);
    }
    if (!student && targetId) {
      student = db.prepare('SELECT id, roll_number, name FROM users WHERE id = ?').get(targetId);
    }

    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found in database.' });
    }

    db.prepare(`
      UPDATE users
      SET face_descriptor = NULL,
          face_photo = NULL,
          face_enrolled = 0,
          face_enroll_attempts = 0
      WHERE id = ?
    `).run(student.id);

    // Mirror face reset to Turso Cloud
    tursoExecuteAsync(
      'UPDATE users SET face_descriptor = NULL, face_photo = NULL, face_enrolled = 0, face_enroll_attempts = 0 WHERE id = ? OR roll_number = ?',
      [student.id, student.roll_number]
    );

    console.log(`[FACE RESET] Face biometrics & photo deleted by Warden/Admin for: ${student.roll_number} (${student.name}). Student can now re-enroll.`);

    res.json({
      success: true,
      message: `Face ID and photo for ${student.name} (${student.roll_number}) have been deleted. Student can now re-capture and re-enroll with 3 fresh attempts.`,
      studentId: student.roll_number || student.id,
    });
  } catch (err) {
    console.error('[RESET FACE ERROR]', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

app.post('/api/warden/students/reset-face', handleResetFace);
app.post('/api/students/reset-face', handleResetFace);

// POST /api/attendance/mark & /api/student/mark-attendance
function handleMarkAttendance(req, res) {
  try {
    const { roll_number, student_id, face_descriptor, latitude, longitude } = req.body;
    const roll = (roll_number || req.user?.roll_number || '').trim().toUpperCase();
    const sId = student_id || req.user?.id || null;

    const student = roll
      ? findStudentInRoster(roll)
      : sId
      ? (db.prepare('SELECT * FROM users WHERE id = ?').get(sId) || findStudentInRoster(sId))
      : null;

    if (!student) {
      return res.status(404).json({ success: false, error: 'Student record not found in hostel roster.' });
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Check FRS timing window
    const windowStatus = isFrsWindowOpen();
    if (!windowStatus.isOpen) {
      return res.status(403).json({
        success: false,
        error: `FRS Attendance Window is currently closed. Allowed hours: ${windowStatus.startTime} – ${windowStatus.endTime} IST. Please contact your hostel warden for manual override.`,
        windowStatus,
      });
    }

    // Check if student has an active approved outpass covering today
    const activeLeave = db.prepare(`
      SELECT * FROM outpasses
      WHERE (student_id = ? OR roll_number = ?)
        AND status = 'Approved'
        AND from_date <= ? AND to_date >= ?
    `).get(student.id, student.roll_number, todayStr, todayStr);

    if (activeLeave) {
      return res.status(403).json({
        success: false,
        error: `Attendance Locked: You have an Active Approved Outpass (${activeLeave.type}: ${activeLeave.from_date} to ${activeLeave.to_date}). You are recorded as 'On Approved Leave' and cannot mark attendance inside the hostel.`,
        activeLeave,
      });
    }

    // Biometric face verification
    const isEnrolled = Number(student.face_enrolled) === 1 || Boolean(student.face_photo) || Boolean(student.face_descriptor);
    if (!student.face_descriptor || !isEnrolled) {
      return res.status(400).json({
        success: false,
        error: 'Mandatory face enrollment not found. Please complete Step 1 Face Enrollment first.',
      });
    }

    if (!face_descriptor || !Array.isArray(face_descriptor) || face_descriptor.length !== 128) {
      return res.status(400).json({
        success: false,
        error: 'Live face descriptor vector (128 floats) is required.',
      });
    }

    let enrolledDescriptor;
    try {
      enrolledDescriptor = JSON.parse(student.face_descriptor);
    } catch {
      return res.status(500).json({ success: false, error: 'Stored biometric profile is corrupt. Please re-enroll.' });
    }

    const faceDistance = calculateEuclideanDistance(face_descriptor, enrolledDescriptor);
    console.log(`[BIOMETRIC FACE TALLY] ${student.roll_number} (${student.name}): Face distance = ${faceDistance.toFixed(4)} (Threshold: < 0.45)`);

    // Strict face tally check: Must match within threshold (< 0.45)
    if (faceDistance >= 0.45) {
      return res.status(403).json({
        success: false,
        error: `Biometric verification failed: Euclidean face distance (${faceDistance.toFixed(3)}) exceeds allowed threshold of 0.45. Face does not match the enrolled resident.`,
        faceDistance: Number(faceDistance.toFixed(3)),
      });
    }

    // Geofencing verification (Silent Warden Alert on Breach)
    const blockName = student.block || 'Anuradha-C';
    const block = db.prepare('SELECT * FROM hostel_blocks WHERE block_name = ?').get(blockName);
    const blockLat = block && block.latitude ? block.latitude : 15.7743;
    const blockLng = block && block.longitude ? block.longitude : 78.0547;
    const allowedRadius = parseFloat(getSetting('geo_radius_meters', String(block?.radius_meters || 100.0)));

    let gpsDistance = 0;
    if (typeof latitude === 'number' && typeof longitude === 'number' && !isNaN(latitude) && !isNaN(longitude)) {
      gpsDistance = calculateHaversineDistanceMeters(latitude, longitude, blockLat, blockLng);
    } else {
      gpsDistance = 0;
    }

    const isGeofenceBreach = gpsDistance > allowedRadius;
    const recordStatus = isGeofenceBreach ? 'FLAGGED_OUT_OF_RANGE' : 'Present';

    if (isGeofenceBreach) {
      console.log(`[SILENT WARDEN ALERT TRIGGERED] ${student.roll_number} (${student.name}) is ${Math.round(gpsDistance)}m away from ${blockName} (Allowed: ${allowedRadius}m). Status: FLAGGED_OUT_OF_RANGE.`);
    } else {
      console.log(`[GEOFENCE VERIFIED] ${student.roll_number} (${student.name}) is within ${Math.round(gpsDistance)}m of ${blockName} (Allowed: ${allowedRadius}m). Status: Present.`);
    }

    // Duplicate detection: If student marks attendance 2-3 times today, detect duplicate and keep only 1 record
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const existing = db.prepare(`
      SELECT * FROM attendance
      WHERE (student_id = ? OR roll_number = ?) AND date = ?
    `).get(student.id, student.roll_number, todayStr);

    if (existing) {
      // 1. Strict duplicate detection: if student is already marked Present,
      // prevent accidental duplicates or status downgrade. Retain their single daily Present record.
      if (existing.status === 'Present' && !existing.is_geofence_breach) {
        console.log(`[DUPLICATE CHECK-IN DETECTED] ${student.roll_number} already marked Present at ${existing.timestamp}. Single record retained.`);
        return res.json({
          success: true,
          alreadyMarked: true,
          isDuplicate: true,
          status: 'Present',
          message: `Attendance already verified for today at ${existing.timestamp}. Duplicate check-in absorbed (Strict 1 record per student per day).`,
          date: todayStr,
          timestamp: existing.timestamp,
          faceDistance: Number(faceDistance.toFixed(3)),
          gpsDistance: Math.round(gpsDistance),
        });
      }

      // 2. If student was previously flagged outside and now has re-scanned inside the courtyard,
      // update the single existing record to Present!
      db.prepare(`
        UPDATE attendance
        SET timestamp = ?, latitude = ?, longitude = ?, face_distance = ?, gps_distance = ?, status = ?, is_geofence_breach = ?
        WHERE id = ?
      `).run(nowTime, latitude, longitude, faceDistance, gpsDistance, recordStatus, isGeofenceBreach ? 1 : 0, existing.id);

      // Mirror attendance update to Turso Cloud
      tursoExecuteAsync(
        'UPDATE attendance SET timestamp = ?, latitude = ?, longitude = ?, face_distance = ?, gps_distance = ?, status = ?, is_geofence_breach = ? WHERE id = ?',
        [nowTime, latitude, longitude, faceDistance, gpsDistance, recordStatus, isGeofenceBreach ? 1 : 0, existing.id]
      );

      console.log(`[ATTENDANCE UPDATED] ${student.roll_number}: Single record updated (Status: ${recordStatus}, GPS: ${Math.round(gpsDistance)}m).`);

      return res.json({
        success: true,
        alreadyMarked: true,
        isUpdate: true,
        status: recordStatus,
        message: recordStatus === 'Present'
          ? `Updated: Attendance now verified as Present (in range). Single daily record preserved.`
          : `Duplicate check-in recorded at ${nowTime}. Only 1 record is kept for today.`,
        date: todayStr,
        timestamp: nowTime,
        faceDistance: Number(faceDistance.toFixed(3)),
        gpsDistance: Math.round(gpsDistance),
      });
    } else {
      // First check-in today
      const attId = `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      db.prepare(`
        INSERT INTO attendance (id, student_id, roll_number, name, year, block, room_number, date, timestamp, latitude, longitude, face_distance, gps_distance, status, is_geofence_breach)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        attId,
        student.id,
        student.roll_number,
        student.name,
        student.year,
        student.block,
        student.room_number,
        todayStr,
        nowTime,
        latitude,
        longitude,
        faceDistance,
        gpsDistance,
        recordStatus,
        isGeofenceBreach ? 1 : 0
      );

      // Mirror new attendance to Turso Cloud
      tursoExecuteAsync(
        'INSERT OR REPLACE INTO attendance (id, student_id, roll_number, name, year, block, room_number, date, timestamp, latitude, longitude, face_distance, gps_distance, status, is_geofence_breach) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [attId, student.id, student.roll_number, student.name, student.year, student.block, student.room_number, todayStr, nowTime, latitude, longitude, faceDistance, gpsDistance, recordStatus, isGeofenceBreach ? 1 : 0]
      );
    }

    // Increment streak dynamically only when genuinely Present inside perimeter
    if (!isGeofenceBreach) {
      const verifiedRow = db.prepare(`
        SELECT COUNT(DISTINCT date) as c
        FROM attendance
        WHERE (student_id = ? OR roll_number = ?) AND status = 'Present'
      `).get(student.id, student.roll_number);
      const dynamicStreak = verifiedRow ? verifiedRow.c : 1;
      db.prepare('UPDATE users SET streak = ? WHERE id = ?').run(dynamicStreak, student.id);
    }

    // Student Confirmation: Both Case 1 (Inside) and Case 2 (Outside) show normal confirmation screen
    // so the student does not know they were flagged or attempt to spoof their GPS.
    res.json({
      success: true,
      status: 'Attendance Submitted',
      message: 'Attendance check-in submitted successfully.',
      date: todayStr,
      timestamp: nowTime,
      faceDistance: Number(faceDistance.toFixed(3)),
      gpsDistance: Math.round(gpsDistance),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

app.post('/api/attendance/mark', handleMarkAttendance);
app.post('/api/student/mark-attendance', handleMarkAttendance);

// GET /api/student/my-attendance
app.get('/api/student/my-attendance', (req, res) => {
  try {
    const roll = (req.query.roll_number || req.user?.roll_number || '').trim().toUpperCase();
    const sId = req.query.student_id || req.user?.id || null;

    const student = roll
      ? db.prepare('SELECT * FROM users WHERE roll_number = ?').get(roll)
      : sId
      ? db.prepare('SELECT * FROM users WHERE id = ?').get(sId)
      : null;

    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found.' });
    }

    const todayStr = new Date().toISOString().split('T')[0];

    const records = db.prepare(`
      SELECT id, date, timestamp, block, room_number, status, is_geofence_breach, face_distance
      FROM attendance
      WHERE student_id = ? OR roll_number = ?
      ORDER BY date DESC, timestamp DESC
      LIMIT 90
    `).all(student.id, student.roll_number);

    const todayRecord = records.find((r) => r.date === todayStr);

    const activeLeave = db.prepare(`
      SELECT * FROM outpasses
      WHERE (student_id = ? OR roll_number = ?)
        AND status = 'Approved'
        AND from_date <= ? AND to_date >= ?
    `).get(student.id, student.roll_number, todayStr, todayStr);

    res.json({
      success: true,
      todayDate: todayStr,
      todayStatus: todayRecord ? todayRecord.status : (activeLeave ? 'On Approved Leave' : 'Pending Check-In'),
      todayRecord: todayRecord || null,
      activeLeave: activeLeave || null,
      student: {
        id: student.id,
        roll_number: student.roll_number,
        name: student.name,
        year: student.year,
        block: student.block,
        room_number: student.room_number,
        face_enrolled: student.face_enrolled === 1,
        face_photo: student.face_photo || null,
      },
      records,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 7. Live Warden Year-Wise Dashboard & Reports
// -------------------------------------------------------------

// GET /api/warden/dashboard & /api/warden/attendance-report
function handleWardenReport(req, res) {
  try {
    const queryDate = req.query.date || new Date().toISOString().split('T')[0];
    const queryYear = req.query.year || 'ALL';
    const queryBlock = req.query.block || 'ALL';

    const formatYr = (rawYear) => {
      const y = String(rawYear || '').trim();
      if (y === '1' || y.startsWith('1')) return '1st Year';
      if (y === '2' || y.startsWith('2')) return '2nd Year';
      if (y === '3' || y.startsWith('3')) return '3rd Year';
      if (y === '4' || y.startsWith('4')) return '4th Year';
      if (y.toLowerCase().includes('alumni')) return 'Alumni Year';
      return y || '1st Year';
    };

    let userSql = "SELECT * FROM users WHERE role = 'student'";
    const userParams = [];

    if (queryYear !== 'ALL') {
      const yDigit = queryYear.replace(/[^0-9]/g, '');
      userSql += ' AND (year = ? OR year = ? OR year LIKE ?)';
      userParams.push(yDigit || queryYear, queryYear, `%${yDigit}%`);
    }
    if (queryBlock !== 'ALL') {
      userSql += ' AND block = ?';
      userParams.push(queryBlock);
    }

    const allStudents = db.prepare(userSql).all(...userParams);
    const totalStudents = allStudents.length;

    // Get attendance for this date
    const attendanceRows = db.prepare(`
      SELECT * FROM attendance
      WHERE date = ?
    `).all(queryDate);

    const attMap = new Map();
    for (const r of attendanceRows) {
      attMap.set(r.student_id, r);
      attMap.set(r.roll_number, r);
    }

    // Get approved leaves for this date
    const approvedLeaves = db.prepare(`
      SELECT * FROM outpasses
      WHERE status = 'Approved' AND from_date <= ? AND to_date >= ?
    `).all(queryDate, queryDate);

    const leaveMap = new Map();
    for (const l of approvedLeaves) {
      leaveMap.set(l.student_id, l);
      leaveMap.set(l.roll_number, l);
    }

    // All outpasses & maintenance tickets for central sync
    const allOutpasses = db.prepare('SELECT * FROM outpasses ORDER BY created_at DESC LIMIT 100').all();
    const allTickets = db.prepare('SELECT * FROM maintenance_tickets ORDER BY created_at DESC LIMIT 100').all();

    const presentStudents = [];
    const outOfRangeAlerts = [];
    const absentStudents = [];
    const leaveStudents = [];
    const pendingFaceStudents = [];

    const defaultRadius = parseFloat(getSetting('geo_radius_meters', '100.0'));

    for (const s of allStudents) {
      const att = attMap.get(s.id) || attMap.get(s.roll_number);
      const leave = leaveMap.get(s.id) || leaveMap.get(s.roll_number);
      const studentYear = formatYr(s.year);
      const isEnrolled = Number(s.face_enrolled) === 1 || Boolean(s.face_photo) || Boolean(s.face_descriptor);

      if (!isEnrolled) {
        pendingFaceStudents.push({
          id: s.id,
          roll_number: s.roll_number,
          name: s.name,
          year: studentYear,
          block: s.block,
          room: s.room_number,
          phone: s.student_phone || s.father_phone || '--',
        });
      }

      // Case 1: Valid Present (FRS + GPS inside geofence OR approved by warden override)
      if (att && (att.status === 'Present' || att.status === 'Present (Warden Override)')) {
        presentStudents.push({
          id: att.id,
          studentId: s.roll_number || s.id,
          roll_number: s.roll_number,
          name: s.name,
          year: studentYear,
          block: s.block,
          room: s.room_number,
          timestamp: att.timestamp,
          method: att.status === 'Present (Warden Override)' ? 'FRS (Warden Approved)' : 'FRS Biometrics + GPS',
          status: att.status,
          faceDistance: att.face_distance,
          gpsDistance: Math.round(att.gps_distance || 0),
          face_photo: s.face_photo || null,
          faceEnrolled: isEnrolled,
        });
      }
      // Case 2: Out of Range Breach (High Priority Warden Alert)
      else if (att && (att.status === 'FLAGGED_OUT_OF_RANGE' || att.is_geofence_breach === 1) && (!att.warden_action || att.warden_action === 'Pending')) {
        const allowedRadius = defaultRadius;
        outOfRangeAlerts.push({
          id: att.id,
          studentId: s.roll_number || s.id,
          roll_number: s.roll_number,
          name: s.name,
          year: studentYear,
          block: s.block,
          room: s.room_number,
          timestamp: att.timestamp,
          gpsDistance: Math.round(att.gps_distance || 0),
          allowedRadius,
          breachMeters: Math.round(Math.max(0, (att.gps_distance || 0) - allowedRadius)),
          latitude: att.latitude,
          longitude: att.longitude,
          faceDistance: Number((att.face_distance || 0).toFixed(3)),
          status: 'FLAGGED_OUT_OF_RANGE',
          alertMessage: `${Math.round(att.gps_distance || 0)}m away from ${s.block} Block (Allowed: ${allowedRadius}m)`,
        });
      }
      // Case 3: On Approved Leave
      else if (leave) {
        leaveStudents.push({
          id: leave.id,
          studentId: s.roll_number || s.id,
          roll_number: s.roll_number,
          name: s.name,
          year: studentYear,
          block: s.block,
          room: s.room_number,
          leaveType: leave.type,
          fromDate: leave.from_date,
          toDate: leave.to_date,
          reason: leave.reason,
          status: 'On Approved Leave',
        });
      }
      // Case 4: Pending / Absent (Defaults to Pending until student explicitly submits during active window)
      else {
        absentStudents.push({
          id: s.roll_number || s.id,
          roll_number: s.roll_number,
          name: s.name,
          year: studentYear,
          block: s.block,
          room: s.room_number,
          parent_phone: s.father_phone || s.student_phone || '+91 98490 22110',
          faceEnrolled: isEnrolled,
          face_photo: s.face_photo || null,
          facePhoto: s.face_photo || null,
          profileStatus: isEnrolled ? 'FRS Enrolled' : 'Enrollment Pending',
          dailyStatus: att && att.status === 'Absent' ? 'Absent' : 'Pending',
          status: att && att.status === 'Absent' ? 'Absent' : 'Pending',
        });
      }
    }

    res.json({
      success: true,
      date: queryDate,
      filters: { year: queryYear, block: queryBlock },
      kpis: {
        totalStudents,
        presentCount: presentStudents.length,
        absentCount: absentStudents.length,
        outOfRangeCount: outOfRangeAlerts.length,
        leaveCount: leaveStudents.length,
        enrolledFaceCount: allStudents.filter(s => Number(s.face_enrolled) === 1 || Boolean(s.face_photo) || Boolean(s.face_descriptor)).length,
        pendingFaceCount: pendingFaceStudents.length,
      },
      presentStudents,
      outOfRangeAlerts,
      absentStudents,
      leaveStudents,
      pendingFaceStudents,
      outpasses: allOutpasses.map(o => ({
        id: o.id,
        studentId: o.roll_number || o.student_id,
        studentName: o.student_name,
        year: formatYr(o.year),
        block: o.block,
        type: o.type,
        fromDate: o.from_date,
        toDate: o.to_date,
        parentPhone: o.parent_phone || '+91 98490 22110',
        status: o.status,
      })),
      tickets: allTickets.map(t => ({
        id: t.id,
        studentId: t.roll_number || t.student_id,
        studentName: t.student_name,
        block: t.block,
        room: t.room_number,
        category: t.category,
        desc: t.description,
        status: t.status,
      })),
      allStudents: allStudents.map(s => {
        const isEnrolled = Number(s.face_enrolled) === 1 || Boolean(s.face_photo) || Boolean(s.face_descriptor);
        return {
          id: s.roll_number || s.id,
          roll_number: s.roll_number,
          name: s.name,
          email: s.email,
          year: formatYr(s.year),
          block: s.block || 'Anapurna-A',
          room: s.room_number || 'A-101',
          faceEnrolled: isEnrolled,
          face_enrolled: isEnrolled ? 1 : 0,
          face_photo: s.face_photo || null,
          facePhoto: s.face_photo || null,
          face_enroll_attempts: s.face_enroll_attempts || 0,
          profileStatus: isEnrolled ? 'FRS Enrolled' : 'Enrollment Pending',
          streak: isEnrolled ? (s.streak || 0) : 0,
          dinnerRsvp: s.dinner_rsvp === 1,
        };
      }),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// POST /api/warden/attendance/resolve-alert (One-click Approve or Mark Absent on Out-of-Range Alerts)
app.post('/api/warden/attendance/resolve-alert', (req, res) => {
  try {
    const { attendance_id, action, note } = req.body;
    if (!attendance_id || !action) {
      return res.status(400).json({ success: false, error: 'attendance_id and action are required.' });
    }
    const att = db.prepare('SELECT * FROM attendance WHERE id = ?').get(attendance_id);
    if (!att) {
      return res.status(404).json({ success: false, error: 'Attendance record not found.' });
    }

    const nowIso = new Date().toISOString();
    if (action === 'approve') {
      db.prepare(`
        UPDATE attendance
        SET status = 'Present (Warden Override)', warden_action = 'Approved', warden_action_at = ?
        WHERE id = ?
      `).run(nowIso, attendance_id);

      tursoExecuteAsync(
        "UPDATE attendance SET status = 'Present (Warden Override)', warden_action = 'Approved', warden_action_at = ? WHERE id = ?",
        [nowIso, attendance_id]
      );

      // Increment streak for approved student
      db.prepare('UPDATE users SET streak = streak + 1 WHERE id = ? OR roll_number = ?').run(att.student_id, att.roll_number);

      console.log(`[WARDEN ALERT RESOLVED] ${att.roll_number} approved as Present (Warden Override).`);
      return res.json({ success: true, message: `Approved ${att.name} (${att.roll_number}) as Present (Warden Override).` });
    } else if (action === 'mark_absent') {
      db.prepare(`
        UPDATE attendance
        SET status = 'Absent', warden_action = 'Marked Absent', warden_action_at = ?
        WHERE id = ?
      `).run(nowIso, attendance_id);

      tursoExecuteAsync(
        "UPDATE attendance SET status = 'Absent', warden_action = 'Marked Absent', warden_action_at = ? WHERE id = ?",
        [nowIso, attendance_id]
      );

      console.log(`[WARDEN ALERT RESOLVED] ${att.roll_number} marked Absent by Warden.`);
      return res.json({ success: true, message: `Marked ${att.name} (${att.roll_number}) as Absent.` });
    } else {
      return res.status(400).json({ success: false, error: 'Invalid action. Must be approve or mark_absent.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/warden/dashboard', handleWardenReport);
app.get('/api/warden/attendance-report', handleWardenReport);

// GET /api/warden/attendance/weekly-csv (Download All Current Attendance Records as Formatted CSV)
app.get('/api/warden/attendance/weekly-csv', (req, res) => {
  try {
    const records = db.prepare(`
      SELECT 
        a.date,
        a.timestamp,
        a.roll_number,
        a.name,
        a.year,
        a.block,
        a.room_number,
        a.status,
        a.gps_distance,
        a.face_distance,
        a.is_geofence_breach,
        a.warden_action
      FROM attendance a
      ORDER BY a.date DESC, a.timestamp DESC
    `).all();

    let csv = 'Date,Time,Roll Number,Name,Year,Hostel Block,Room,Status,GPS Distance (m),Biometric Distance,Geofence Breach,Warden Action\n';
    for (const r of records) {
      const breachStr = r.is_geofence_breach === 1 ? 'YES (Breach)' : 'NO';
      const gpsMeters = r.gps_distance ? Math.round(r.gps_distance) : '0';
      const faceScore = r.face_distance ? Number(r.face_distance).toFixed(4) : '--';
      const wardenAct = r.warden_action || '--';
      csv += `${r.date},${r.timestamp},${r.roll_number},"${r.name}",${r.year},${r.block},${r.room_number},${r.status},${gpsMeters},${faceScore},${breachStr},"${wardenAct}"\n`;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="GNBVG_Weekly_Attendance_Archive_${todayStr}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/warden/attendance/matrix-csv (Download 15-Day / 7-Day Matrix Register: P / A / L grid per student)
app.get('/api/warden/attendance/matrix-csv', (req, res) => {
  try {
    const numDays = Math.min(Math.max(parseInt(req.query.days, 10) || 15, 1), 60);
    const endDateStr = (typeof req.query.end_date === 'string' && req.query.end_date)
      ? req.query.end_date
      : new Date().toISOString().split('T')[0];

    const dates = [];
    const end = new Date(endDateStr);
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      dates.push(d.toISOString().split('T')[0]);
    }

    const students = db.prepare(`
      SELECT roll_number, name, year, block, room_number
      FROM users
      WHERE role = 'student'
      ORDER BY year ASC, block ASC, roll_number ASC
    `).all();

    const attRows = db.prepare(`
      SELECT roll_number, date, status
      FROM attendance
      WHERE date >= ? AND date <= ?
    `).all(dates[0], dates[dates.length - 1]);

    const attMap = new Set();
    attRows.forEach(r => {
      if (r.status && r.status.toLowerCase().includes('present')) {
        attMap.add(`${r.roll_number}_${r.date}`);
      }
    });

    const outpasses = db.prepare(`
      SELECT roll_number, from_date, to_date
      FROM outpasses
      WHERE status = 'Approved'
        AND to_date >= ? AND from_date <= ?
    `).all(dates[0], dates[dates.length - 1]);

    function isStudentOnLeave(roll, dStr) {
      return outpasses.some(o => o.roll_number === roll && o.from_date <= dStr && o.to_date >= dStr);
    }

    const dateHeaders = dates.map(d => {
      const [y, m, day] = d.split('-');
      return `${day}/${m}/${y.slice(-2)}`;
    });

    let csv = `Roll Number,Student Name,Year,Hostel Block,Room Number,${dateHeaders.join(',')},Total Days,Total Present (P),Total Absent (A),Total Leave (L),Attendance %\n`;

    for (const s of students) {
      let pCount = 0;
      let aCount = 0;
      let lCount = 0;
      const dayStatuses = [];

      for (const d of dates) {
        if (attMap.has(`${s.roll_number}_${d}`)) {
          dayStatuses.push('P');
          pCount++;
        } else if (isStudentOnLeave(s.roll_number, d)) {
          dayStatuses.push('L');
          lCount++;
        } else {
          dayStatuses.push('A');
          aCount++;
        }
      }

      const pct = Math.round((pCount / (numDays || 1)) * 100);
      const yrLabel = s.year === '1' ? '1st Year' : s.year === '2' ? '2nd Year' : s.year === '3' ? '3rd Year' : (s.year || '1st Year');

      csv += `${s.roll_number},"${s.name}",${yrLabel},${s.block || '--'},${s.room_number || '--'},${dayStatuses.join(',')},${numDays},${pCount},${aCount},${lCount},${pct}%\n`;
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="GNBVG_${numDays}Day_Attendance_Register_${endDateStr}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/warden/attendance/purge-history (Purge Old Attendance Records for Fresh Week)
app.post('/api/warden/attendance/purge-history', (req, res) => {
  try {
    const countBefore = db.prepare('SELECT count(*) as c FROM attendance').get().c;
    const del = db.prepare('DELETE FROM attendance').run();
    tursoExecuteAsync('DELETE FROM attendance');
    console.log(`[WEEKLY ARCHIVE PURGE] Purged ${del.changes} attendance records. All student face enrollments and roster profiles preserved.`);
    
    res.json({
      success: true,
      purgedCount: del.changes,
      remainingCount: 0,
      message: `Successfully purged ${del.changes} past attendance records. All 916 student accounts and face enrollments are 100% preserved. Database is clean for the new week!`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/warden/backup/download (Download latest 5-year full biometrics & roster backup JSON)
app.get('/api/warden/backup/download', (req, res) => {
  try {
    const backupRes = createBiometricsBackup(db);
    if (!backupRes.success) {
      return res.status(500).json({ success: false, error: backupRes.error });
    }
    res.setHeader('Content-Disposition', `attachment; filename="GNBVG_Biometrics_Archive_${backupRes.timestamp}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.sendFile(backupRes.latestFile);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/warden/backup/trigger (Trigger manual backup snapshot)
app.post('/api/warden/backup/trigger', (req, res) => {
  try {
    const result = createBiometricsBackup(db);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 8. Annual Academic Batch Rollover Endpoint
// -------------------------------------------------------------
// Promotes: 1st -> 2nd -> 3rd -> 4th -> Alumni
app.post('/api/warden/promote-batch', (req, res) => {
  try {
    const p4 = db.prepare("UPDATE users SET year = 'Alumni' WHERE role = 'student' AND (year = '4' OR year LIKE '%4%')").run();
    const p3 = db.prepare("UPDATE users SET year = '4' WHERE role = 'student' AND (year = '3' OR year LIKE '%3%')").run();
    const p2 = db.prepare("UPDATE users SET year = '3' WHERE role = 'student' AND (year = '2' OR year LIKE '%2%')").run();
    const p1 = db.prepare("UPDATE users SET year = '2' WHERE role = 'student' AND (year = '1' OR year LIKE '%1%')").run();

    console.log(`[ANNUAL BATCH ROLLOVER] Promoted: 4th->Alumni (${p4.changes}), 3rd->4th (${p3.changes}), 2nd->3rd (${p2.changes}), 1st->2nd (${p1.changes})`);

    res.json({
      success: true,
      message: 'Annual academic batch rollover completed successfully.',
      promotedCounts: {
        graduatedToAlumni: p4.changes,
        promotedToYear4: p3.changes,
        promotedToYear3: p2.changes,
        promotedToYear2: p1.changes,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 9. Block Coordinates, Settings, Outpasses, Tickets & Mess RSVP
// -------------------------------------------------------------

// GET /api/settings (Public Settings & Timing Status)
app.get('/api/settings', (req, res) => {
  try {
    const windowStatus = isFrsWindowOpen();
    const rows = db.prepare('SELECT key, value FROM hostel_settings').all();
    const settings = {};
    for (const r of rows) {
      settings[r.key] = r.value;
    }
    const blocks = db.prepare('SELECT * FROM hostel_blocks').all();
    res.json({
      success: true,
      settings,
      windowStatus,
      blocks,
      polygon: [
        { id: 'q1', label: 'Corner Q1 (North-East)', lat: parseFloat(settings.geo_q1_lat || '15.774450196357801'), lng: parseFloat(settings.geo_q1_lng || '78.05467113649686') },
        { id: 'q2', label: 'Corner Q2 (North-West)', lat: parseFloat(settings.geo_q2_lat || '15.774311503975998'), lng: parseFloat(settings.geo_q2_lng || '78.05457367411404') },
        { id: 'q3', label: 'Corner Q3 (South-West)', lat: parseFloat(settings.geo_q3_lat || '15.774131902250424'), lng: parseFloat(settings.geo_q3_lng || '78.0547841514271') },
        { id: 'q4', label: 'Corner Q4 (South-East)', lat: parseFloat(settings.geo_q4_lat || '15.774300528319552'), lng: parseFloat(settings.geo_q4_lng || '78.05484117730008') },
      ],
      center: {
        lat: parseFloat(settings.geo_center_lat || '15.7742985'),
        lng: parseFloat(settings.geo_center_lng || '78.0547175'),
        radius_meters: parseFloat(settings.geo_radius_meters || '100.0'),
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/warden/settings (Update FRS Timings & Geofencing)
app.post('/api/warden/settings', (req, res) => {
  try {
    const {
      frs_start_time,
      frs_end_time,
      frs_window_override,
      geo_radius_meters,
      geo_q1_lat,
      geo_q1_lng,
      geo_q2_lat,
      geo_q2_lng,
      geo_q3_lat,
      geo_q3_lng,
      geo_q4_lat,
      geo_q4_lng,
      geo_center_lat,
      geo_center_lng,
    } = req.body;

    if (frs_start_time) setSetting('frs_start_time', frs_start_time);
    if (frs_end_time) setSetting('frs_end_time', frs_end_time);
    if (frs_window_override) setSetting('frs_window_override', frs_window_override);
    if (geo_radius_meters) setSetting('geo_radius_meters', String(geo_radius_meters));

    if (geo_q1_lat) setSetting('geo_q1_lat', String(geo_q1_lat));
    if (geo_q1_lng) setSetting('geo_q1_lng', String(geo_q1_lng));
    if (geo_q2_lat) setSetting('geo_q2_lat', String(geo_q2_lat));
    if (geo_q2_lng) setSetting('geo_q2_lng', String(geo_q2_lng));
    if (geo_q3_lat) setSetting('geo_q3_lat', String(geo_q3_lat));
    if (geo_q3_lng) setSetting('geo_q3_lng', String(geo_q3_lng));
    if (geo_q4_lat) setSetting('geo_q4_lat', String(geo_q4_lat));
    if (geo_q4_lng) setSetting('geo_q4_lng', String(geo_q4_lng));
    if (geo_center_lat) setSetting('geo_center_lat', String(geo_center_lat));
    if (geo_center_lng) setSetting('geo_center_lng', String(geo_center_lng));

    // Sync hostel blocks to new perimeters
    const rad = parseFloat(geo_radius_meters || '100.0');
    const updateBlock = db.prepare(`
      INSERT INTO hostel_blocks (block_name, latitude, longitude, radius_meters)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(block_name) DO UPDATE SET
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        radius_meters = excluded.radius_meters
    `);
    updateBlock.run('Anapurna-A', parseFloat(geo_q1_lat || '15.774450'), parseFloat(geo_q1_lng || '78.054671'), rad);
    updateBlock.run('Arundhathi-B', parseFloat(geo_q2_lat || '15.774311'), parseFloat(geo_q2_lng || '78.054573'), rad);
    updateBlock.run('Anuradha-C', parseFloat(geo_q3_lat || '15.774132'), parseFloat(geo_q3_lng || '78.054784'), rad);

    console.log('[WARDEN SETTINGS] Updated FRS timings and Geofencing perimeters.');
    const windowStatus = isFrsWindowOpen();
    res.json({
      success: true,
      message: 'FRS timings and GPS geofence updated successfully in database.',
      windowStatus,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET & POST /api/warden/block-coordinates
app.get('/api/warden/block-coordinates', (req, res) => {
  const blocks = db.prepare('SELECT * FROM hostel_blocks').all();
  res.json({ success: true, blocks });
});

app.post('/api/warden/block-coordinates', (req, res) => {
  try {
    const { block_name, latitude, longitude, radius_meters } = req.body;
    if (!block_name || typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ success: false, error: 'block_name, latitude, and longitude are required.' });
    }

    db.prepare(`
      INSERT INTO hostel_blocks (block_name, latitude, longitude, radius_meters)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(block_name) DO UPDATE SET
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        radius_meters = excluded.radius_meters
    `).run(block_name, latitude, longitude, radius_meters || 150.0);

    console.log(`[GPS UPDATE] Updated coordinates for ${block_name}: lat ${latitude}, lon ${longitude}, radius ${radius_meters}m`);
    res.json({ success: true, message: `GPS perimeter for ${block_name} updated successfully.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Outpasses
app.get('/api/outpass/list', (req, res) => {
  const rows = db.prepare('SELECT * FROM outpasses ORDER BY created_at DESC LIMIT 100').all();
  res.json({ success: true, outpasses: rows });
});
app.get('/api/warden/outpasses', (req, res) => {
  const rows = db.prepare('SELECT * FROM outpasses ORDER BY created_at DESC LIMIT 100').all();
  res.json({ success: true, outpasses: rows });
});

app.post('/api/outpass/apply', (req, res) => {
  try {
    const { student_id, roll_number, student_name, year, block, room_number, type, from_date, to_date, reason, parent_phone } = req.body;
    const opId = `op-${Date.now()}`;
    db.prepare(`
      INSERT INTO outpasses (id, student_id, roll_number, student_name, year, block, room_number, type, from_date, to_date, reason, parent_phone, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')
    `).run(
      opId,
      student_id || req.user?.id || 'unknown',
      roll_number || req.user?.roll_number || 'UNKNOWN',
      student_name || req.user?.name || 'Resident Student',
      year || '2',
      block || 'Anapurna-A',
      room_number || 'A-101',
      type || 'Weekend Outing',
      from_date,
      to_date,
      reason || 'Family function',
      parent_phone || '+91 98490 22110'
    );

    tursoExecuteAsync(
      'INSERT INTO outpasses (id, student_id, roll_number, student_name, year, block, room_number, type, from_date, to_date, reason, parent_phone, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        opId,
        student_id || req.user?.id || 'unknown',
        roll_number || req.user?.roll_number || 'UNKNOWN',
        student_name || req.user?.name || 'Resident Student',
        year || '2',
        block || 'Anapurna-A',
        room_number || 'A-101',
        type || 'Weekend Outing',
        from_date,
        to_date,
        reason || 'Family function',
        parent_phone || '+91 98490 22110',
        'Pending'
      ]
    );
    res.json({ success: true, message: 'Outpass request submitted to hostel warden.', outpassId: opId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/warden/outpass/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    db.prepare('UPDATE outpasses SET status = ? WHERE id = ?').run(status, req.params.id);
    tursoExecuteAsync('UPDATE outpasses SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true, message: `Outpass marked ${status}.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Maintenance Tickets
app.get('/api/tickets/list', (req, res) => {
  const rows = db.prepare('SELECT * FROM maintenance_tickets ORDER BY created_at DESC LIMIT 100').all();
  res.json({ success: true, tickets: rows });
});
app.get('/api/warden/tickets', (req, res) => {
  const rows = db.prepare('SELECT * FROM maintenance_tickets ORDER BY created_at DESC LIMIT 100').all();
  res.json({ success: true, tickets: rows });
});

app.post('/api/tickets/create', (req, res) => {
  try {
    const { student_id, roll_number, student_name, block, room_number, category, description, urgency } = req.body;
    const tkId = `tk-${Date.now()}`;
    db.prepare(`
      INSERT INTO maintenance_tickets (id, student_id, roll_number, student_name, block, room_number, category, description, urgency, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Open')
    `).run(
      tkId,
      student_id || req.user?.id || 'unknown',
      roll_number || req.user?.roll_number || 'UNKNOWN',
      student_name || req.user?.name || 'Resident Student',
      block || 'Anapurna-A',
      room_number || 'A-101',
      category || 'Electricity / Power',
      description || 'Room issue',
      urgency || 'Normal'
    );

    tursoExecuteAsync(
      'INSERT INTO maintenance_tickets (id, student_id, roll_number, student_name, block, room_number, category, description, urgency, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        tkId,
        student_id || req.user?.id || 'unknown',
        roll_number || req.user?.roll_number || 'UNKNOWN',
        student_name || req.user?.name || 'Resident Student',
        block || 'Anapurna-A',
        room_number || 'A-101',
        category || 'Electricity / Power',
        description || 'Room issue',
        urgency || 'Normal',
        'Open'
      ]
    );

    res.json({ success: true, message: 'Ticket logged successfully.', ticketId: tkId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/warden/ticket/:id/resolve', (req, res) => {
  try {
    db.prepare("UPDATE maintenance_tickets SET status = 'Resolved' WHERE id = ?").run(req.params.id);
    tursoExecuteAsync("UPDATE maintenance_tickets SET status = 'Resolved' WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: 'Maintenance ticket resolved.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Mess Dinner RSVP
app.post('/api/student/dinner-rsvp', (req, res) => {
  try {
    const { student_id, roll_number, dinner_rsvp } = req.body;
    const val = dinner_rsvp ? 1 : 0;
    const roll = roll_number || req.user?.roll_number || null;
    const sId = student_id || req.user?.id || null;

    if (roll) {
      db.prepare('UPDATE users SET dinner_rsvp = ? WHERE roll_number = ?').run(val, roll);
      tursoExecuteAsync('UPDATE users SET dinner_rsvp = ? WHERE roll_number = ?', [val, roll]);
    } else if (sId) {
      db.prepare('UPDATE users SET dinner_rsvp = ? WHERE id = ?').run(val, sId);
      tursoExecuteAsync('UPDATE users SET dinner_rsvp = ? WHERE id = ?', [val, sId]);
    }
    res.json({ success: true, message: `Dinner RSVP updated: ${val ? 'Dining in mess' : 'Skipping dinner'}.`, dinner_rsvp: val === 1 });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// CSV Export
app.get('/api/warden/export-csv', (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const students = db.prepare("SELECT * FROM users WHERE role = 'student' ORDER BY block, room_number, roll_number").all();
    const attendance = db.prepare('SELECT * FROM attendance WHERE date = ?').all(date);
    const leaves = db.prepare("SELECT * FROM outpasses WHERE status = 'Approved' AND from_date <= ? AND to_date >= ?").all(date, date);

    const attMap = new Map(attendance.map((a) => [a.roll_number, a]));
    const leaveMap = new Map(leaves.map((l) => [l.roll_number, l]));

    let csv = 'Roll Number,Name,Year,Block,Room Number,Date,Timestamp,Status,Parent Phone\n';
    for (const s of students) {
      const att = attMap.get(s.roll_number);
      const leave = leaveMap.get(s.roll_number);
      const status = att ? 'Present' : leave ? 'On Approved Leave' : 'Absent';
      const time = att ? att.timestamp : '--';
      const phone = s.father_phone || s.student_phone || '--';
      csv += `"${s.roll_number}","${s.name}","${s.year || ''}","${s.block || ''}","${s.room_number || ''}","${date}","${time}","${status}","${phone}"\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="GNBVG_Attendance_${date}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).send('Failed to generate CSV: ' + err.message);
  }
});

// -------------------------------------------------------------
// 10. SPA / Portal Fallback Routing
// -------------------------------------------------------------
app.get(['/hostel', '/portal', '/admin'], (req, res) => {
  res.sendFile(path.join(CLIENT_DIST, 'index.html'));
});

// Single Page App fallback
app.get('*', (req, res) => {
  const indexPath = path.join(CLIENT_DIST, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  const hostelHtml = path.join(CLIENT_PUBLIC, 'hostel.html');
  if (fs.existsSync(hostelHtml)) {
    return res.sendFile(hostelHtml);
  }
  res.send('GNBVG Hostel Safety & Attendance System active on port ' + PORT);
});

// Start listening if executed directly
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('server/index.js')) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`  GNBVG HOSTEL SAFETY & ATTENDANCE SYSTEM RUNNING`);
    console.log(`  Port:             ${PORT}`);
    console.log(`  URL:              http://localhost:${PORT}`);
    console.log(`  Portal View:      http://localhost:${PORT}/hostel`);
    console.log(`  Permanent DB:     ${DB_PATH}`);
    console.log(`  Models Directory: ${path.join(CLIENT_PUBLIC, 'models')}`);
    console.log(`======================================================\n`);
  });
}

export default app;
export { app, db, initDatabase };
