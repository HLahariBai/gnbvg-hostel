import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('database/gnbvg.db');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(t => t.name));

const sampleUsers = db.prepare("SELECT id, roll_number, name, email FROM users WHERE roll_number LIKE '%33062%'").all();
console.log('Target student in users:', sampleUsers);

const attendanceCount = db.prepare("SELECT count(*) as count FROM attendance").get();
console.log('Attendance total count:', attendanceCount);

const attendanceSample = db.prepare("SELECT * FROM attendance LIMIT 10").all();
console.log('Attendance sample:', attendanceSample);
