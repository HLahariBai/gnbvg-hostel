import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('database/gnbvg.db');
db.exec('BEGIN TRANSACTION;');

const u1 = db.prepare("UPDATE users SET year = '1' WHERE roll_number LIKE '269X%'").run();
const u2 = db.prepare("UPDATE users SET year = '2' WHERE roll_number LIKE '259X%'").run();
const u3 = db.prepare("UPDATE users SET year = '3' WHERE roll_number LIKE '249X%'").run();

db.exec('COMMIT;');

console.log(`[SUCCESS] Restored academic years:`);
console.log(`  - 1st Years (269X...): ${u1.changes} students`);
console.log(`  - 2nd Years (259X...): ${u2.changes} students`);
console.log(`  - 3rd Years (249X...): ${u3.changes} students`);

const breakdown = db.prepare("SELECT year, count(id) as total FROM users WHERE role='student' GROUP BY year ORDER BY year").all();
console.log('\nUpdated Database Academic Breakdown:', breakdown);
