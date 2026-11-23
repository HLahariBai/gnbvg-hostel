import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('database/gnbvg.db');

const tableInfo = db.prepare("PRAGMA table_info(users)").all();
const colNames = tableInfo.map(c => c.name);
console.log('Existing users columns:', colNames);

if (!colNames.includes('face_photo')) {
  db.exec("ALTER TABLE users ADD COLUMN face_photo TEXT;");
  console.log('Added column face_photo to users.');
} else {
  console.log('Column face_photo already exists.');
}

if (!colNames.includes('face_enroll_attempts')) {
  db.exec("ALTER TABLE users ADD COLUMN face_enroll_attempts INTEGER NOT NULL DEFAULT 0;");
  console.log('Added column face_enroll_attempts to users.');
} else {
  console.log('Column face_enroll_attempts already exists.');
}

const updatedCols = db.prepare("PRAGMA table_info(users)").all();
console.log('Updated users columns:', updatedCols.map(c => c.name));
