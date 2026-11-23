import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('./database/gnbvg.db');
const tables = ['users', 'attendance', 'hostel_blocks', 'outpasses', 'maintenance_tickets'];
for (const t of tables) {
  console.log(`\n=== SCHEMA FOR ${t} ===`);
  const cols = db.prepare(`PRAGMA table_info("${t}")`).all();
  for (const c of cols) {
    console.log(`  ${c.name} (${c.type})`);
  }
}
