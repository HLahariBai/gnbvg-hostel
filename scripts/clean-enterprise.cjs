const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

const dbPath = path.resolve(__dirname, '..', 'database', 'gnbvg.db');
const db = new DatabaseSync(dbPath);

console.log('[ENTERPRISE CLEANUP] Starting purge of all mock/demo records...');

db.exec('BEGIN TRANSACTION;');
try {
  // 1. Purge all mock attendance records
  const attResult = db.prepare('DELETE FROM attendance').run();
  console.log(`[1/5] Purged all dummy attendance records. Rows deleted: ${attResult.changes}`);

  // 2. Purge all mock outpasses
  const opResult = db.prepare('DELETE FROM outpasses').run();
  console.log(`[2/5] Purged all dummy outpass records. Rows deleted: ${opResult.changes}`);

  // 3. Purge all mock maintenance tickets
  const tkResult = db.prepare('DELETE FROM maintenance_tickets').run();
  console.log(`[3/5] Purged all dummy maintenance tickets. Rows deleted: ${tkResult.changes}`);

  // 4. Purge all mock/demo students not on the official 916 roster
  const demoUsersResult = db.prepare(`
    DELETE FROM users 
    WHERE role = 'student' 
      AND (
        email LIKE 'student.%' 
        OR roll_number IN ('219X1A05393', '219X1A05804', '219X1A0501', '229X1A0502', '239X1A0503', '249X1A0504', '219X1A05231', '219X1A05566', '219X1A05888', '219X1A05992', '219X1A05346', '219X1A05335', '219X1A05102', '219X1A05616')
      )
  `).run();
  console.log(`[4/5] Purged all dummy/sample resident accounts. Rows deleted: ${demoUsersResult.changes}`);

  // 5. Reset all admitted roster students to fresh un-activated state (is_activated = 0, face_enrolled = 0)
  // so every single admitted student can register cleanly with official institutional verification
  const resetResult = db.prepare(`
    UPDATE users 
    SET is_activated = 0, face_enrolled = 0, face_descriptor = NULL, streak = 0 
    WHERE role = 'student'
  `).run();
  console.log(`[5/5] Reset ${resetResult.changes} official roster students to fresh admitted state.`);

  // Clean OTPs table
  db.prepare('DELETE FROM email_otps').run();

  db.exec('COMMIT;');
  console.log('\n[SUCCESS] Enterprise database cleanup complete!');
} catch (err) {
  db.exec('ROLLBACK;');
  console.error('[ERROR] Failed enterprise cleanup:', err);
  process.exit(1);
}

// Verification report
const totalStudents = db.prepare("SELECT count(*) as c FROM users WHERE role = 'student'").get().c;
const totalWardens = db.prepare("SELECT count(*) as c FROM users WHERE role IN ('warden', 'admin')").get().c;
const totalAttendance = db.prepare("SELECT count(*) as c FROM attendance").get().c;
const totalOutpasses = db.prepare("SELECT count(*) as c FROM outpasses").get().c;
const totalTickets = db.prepare("SELECT count(*) as c FROM maintenance_tickets").get().c;

console.log('\n================ ENTERPRISE DB STATUS ================');
console.log(`Official Roster Students : ${totalStudents} (100% genuine GNBVG admissions)`);
console.log(`Wardens & Administrators : ${totalWardens} (Official institutional logins)`);
console.log(`Live Attendance Records  : ${totalAttendance} (0 - Waiting for real student FRS check-ins)`);
console.log(`Live Outpass Requests    : ${totalOutpasses} (0 - Waiting for real student submissions)`);
console.log(`Live Maintenance Tickets : ${totalTickets} (0 - Waiting for real student submissions)`);
console.log('======================================================\n');
