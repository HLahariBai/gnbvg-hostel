import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const dbPath = path.join(projectRoot, 'database', 'gnbvg.db');
const backupDir = path.join(projectRoot, 'backup');

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

export function exportBiometricsAndDatabase() {
  const db = new DatabaseSync(dbPath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  // 1. All Enrolled Biometric Face Profiles
  const enrolledStudents = db.prepare(`
    SELECT id, roll_number, name, email, year, block, room_number,
           face_enrolled, face_photo, face_descriptor, face_enroll_attempts, streak, created_at
    FROM users
    WHERE face_enrolled = 1
  `).all();

  // 2. All Students Roster
  const allStudents = db.prepare(`
    SELECT id, roll_number, name, email, year, block, room_number, role,
           face_enrolled, face_enroll_attempts, streak, created_at
    FROM users
  `).all();

  // 3. Complete Attendance History
  const attendanceLogs = db.prepare('SELECT * FROM attendance ORDER BY date DESC, timestamp DESC').all();

  // 4. Outpasses and Tickets
  const outpasses = db.prepare('SELECT * FROM outpasses ORDER BY created_at DESC').all();
  const tickets = db.prepare('SELECT * FROM maintenance_tickets ORDER BY created_at DESC').all();
  const settings = db.prepare('SELECT * FROM hostel_settings').all();

  const backupPayload = {
    metadata: {
      generated_at: new Date().toISOString(),
      institution: 'G. Pulla Reddy Engineering College (GPREC) Kurnool',
      facility: 'GNBVG Hostel Safety & Attendance System',
      total_students: allStudents.length,
      enrolled_biometrics_count: enrolledStudents.length,
      total_attendance_records: attendanceLogs.length,
      retention_policy: 'Permanent (5+ Years Cloud & Local Archive)',
    },
    enrolled_biometrics: enrolledStudents,
    all_students_roster: allStudents,
    attendance_records: attendanceLogs,
    outpasses,
    maintenance_tickets: tickets,
    system_settings: settings,
  };

  const timestampFile = path.join(backupDir, `biometrics_backup_${timestamp}.json`);
  const latestFile = path.join(backupDir, 'latest_biometrics_backup.json');

  const jsonString = JSON.stringify(backupPayload, null, 2);
  fs.writeFileSync(timestampFile, jsonString, 'utf-8');
  fs.writeFileSync(latestFile, jsonString, 'utf-8');

  console.log(`[BACKUP SUCCESS] Biometrics & Database backed up successfully:`);
  console.log(` -> Timestamped: ${timestampFile}`);
  console.log(` -> Latest:      ${latestFile}`);
  console.log(` -> Enrolled Biometric Faces Backed Up: ${enrolledStudents.length}`);
  console.log(` -> Total Attendance Records Backed Up:  ${attendanceLogs.length}`);

  return {
    success: true,
    timestamp,
    timestampFile,
    latestFile,
    enrolledCount: enrolledStudents.length,
    totalStudents: allStudents.length,
    attendanceCount: attendanceLogs.length,
    payload: backupPayload,
  };
}

// If executed directly from command line
if (process.argv[1] && process.argv[1].endsWith('backup_biometrics.js')) {
  exportBiometricsAndDatabase();
}
