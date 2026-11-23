const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

const dbPath = path.resolve(__dirname, '..', 'database', 'gnbvg.db');
const db = new DatabaseSync(dbPath);

console.log('[1/3] Updating SQLite users table...');
const beforeCount = db.prepare("SELECT count(*) as c FROM users WHERE roll_number LIKE '269XA%'").get().c;
console.log(`Found ${beforeCount} records with 269XA in database.`);

db.exec('BEGIN TRANSACTION;');
try {
  const result = db.prepare(`
    UPDATE users 
    SET roll_number = '269X1' || SUBSTR(roll_number, 6),
        email = '269x1' || SUBSTR(email, 6),
        year = '1'
    WHERE roll_number LIKE '269XA%'
  `).run();
  db.exec('COMMIT;');
  console.log(`Database updated successfully. Rows affected: ${result.changes}`);
} catch (err) {
  db.exec('ROLLBACK;');
  console.error('Failed to update DB:', err);
  process.exit(1);
}

const countA = db.prepare("SELECT count(*) as c FROM users WHERE roll_number LIKE '269XA%'").get().c;
const count1 = db.prepare("SELECT count(*) as c FROM users WHERE roll_number LIKE '269X1%'").get().c;
console.log(`Current DB state: 269XA=${countA}, 269X1=${count1}`);

// Check specific student H. SAI TEJASWINI
const tejaswini = db.prepare("SELECT roll_number, name, email, year, block, room_number FROM users WHERE name LIKE '%TEJASWINI%'").all();
console.log('Tejaswini record in DB:', tejaswini);

// 2. Update students_roster.json
console.log('\n[2/3] Updating server/data/students_roster.json...');
const jsonPath = path.resolve(__dirname, '..', 'server', 'data', 'students_roster.json');
if (fs.existsSync(jsonPath)) {
  const students = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  let updatedJsonCount = 0;
  for (const s of students) {
    if (s.roll_number && s.roll_number.startsWith('269XA')) {
      s.roll_number = '269X1' + s.roll_number.substring(5);
      if (s.email && s.email.startsWith('269xa')) {
        s.email = '269x1' + s.email.substring(5);
      }
      s.year = '1';
      updatedJsonCount++;
    }
  }
  fs.writeFileSync(jsonPath, JSON.stringify(students, null, 2), 'utf-8');
  console.log(`Updated ${updatedJsonCount} records in students_roster.json.`);
}

// 3. Update students_roster.csv
console.log('\n[3/3] Updating server/data/students_roster.csv...');
const csvPath = path.resolve(__dirname, '..', 'server', 'data', 'students_roster.csv');
if (fs.existsSync(csvPath)) {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const updatedContent = content
    .replace(/"269XA/g, '"269X1')
    .replace(/269xa/g, '269x1');
  fs.writeFileSync(csvPath, updatedContent, 'utf-8');
  console.log(`Updated students_roster.csv successfully.`);
}

console.log('\nALL FIRST YEAR ROSTER RECORDS CONVERTED TO 269X1 AND EMAIL 269x1 SUCCESSFULLY!');
