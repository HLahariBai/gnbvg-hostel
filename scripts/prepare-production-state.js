import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('database/gnbvg.db');

console.log('--- PURGING ATTENDANCE TABLE & CONFIGURING 5:00 PM TO 7:00 PM FRS WINDOW ---');

// Purge all attendance records
const delAtt = db.prepare('DELETE FROM attendance').run();
console.log(`Deleted ${delAtt.changes} attendance records. Attendance is now completely clean.`);

// Set FRS window settings to 17:00 to 19:00 auto
const upsertSetting = db.prepare(`
  INSERT INTO hostel_settings (key, value)
  VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);

upsertSetting.run('frs_start_time', '17:00');
upsertSetting.run('frs_end_time', '19:00');
upsertSetting.run('frs_window_override', 'auto');

console.log('Updated settings: FRS 17:00 - 19:00 IST (05:00 PM – 07:00 PM), Override: auto');

// Check stats
const attCount = db.prepare('SELECT count(*) as c FROM attendance').get().c;
const userCount = db.prepare("SELECT count(*) as c FROM users WHERE role = 'student'").get().c;
const enrolledCount = db.prepare("SELECT count(*) as c FROM users WHERE role = 'student' AND face_enrolled = 1").get().c;
const tejaswini = db.prepare("SELECT roll_number, name, face_enrolled, is_activated FROM users WHERE roll_number = '269X133062'").get();

console.log('Attendance Records Count:', attCount);
console.log('Total Students on Roster:', userCount);
console.log('Face Enrolled Students:', enrolledCount);
console.log('Tejaswini Profile:', tejaswini);
