import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const backupDir = path.join(projectRoot, 'backup');

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

export function createBiometricsBackup(db) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // 1. All Enrolled Biometric Face Profiles with 128-D descriptors and photos
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

    // 4. Outpasses, Tickets, and Settings
    const outpasses = db.prepare('SELECT * FROM outpasses ORDER BY created_at DESC').all();
    const tickets = db.prepare('SELECT * FROM maintenance_tickets ORDER BY created_at DESC').all();
    const settings = db.prepare('SELECT * FROM hostel_settings').all();

    const backupPayload = {
      metadata: {
        generated_at: new Date().toISOString(),
        institution: 'G. Pulla Reddy Engineering College (GPREC) Kurnool',
        facility: 'GNBVG Hostel Safety & Attendance System',
        retention_guarantee: 'Permanent Storage (5+ Years Cloud & Local Archive)',
        total_registered_students: allStudents.length,
        enrolled_biometrics_count: enrolledStudents.length,
        total_attendance_records: attendanceLogs.length,
      },
      enrolled_biometrics: enrolledStudents,
      all_students_roster: allStudents,
      attendance_records: attendanceLogs,
      outpasses,
      maintenance_tickets: tickets,
      hostel_settings: settings,
    };

    const timestampFile = path.join(backupDir, `biometrics_backup_${timestamp}.json`);
    const latestFile = path.join(backupDir, 'latest_biometrics_backup.json');

    const jsonString = JSON.stringify(backupPayload, null, 2);
    fs.writeFileSync(timestampFile, jsonString, 'utf-8');
    fs.writeFileSync(latestFile, jsonString, 'utf-8');

    console.log(`[BIOMETRIC BACKUP CREATED] ${enrolledStudents.length} enrolled faces backed up to: ${latestFile}`);

    return {
      success: true,
      timestamp,
      latestFile,
      timestampFile,
      enrolledCount: enrolledStudents.length,
      totalStudents: allStudents.length,
      attendanceCount: attendanceLogs.length,
      payload: backupPayload,
    };
  } catch (err) {
    console.error('[BIOMETRIC BACKUP ERROR]', err);
    return { success: false, error: err.message };
  }
}
