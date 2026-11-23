import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';

const path = './database/gnbvg.db';
if (fs.existsSync(path)) {
  const db = new DatabaseSync(path);
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('Tables in database/gnbvg.db:');
  for (const t of tables) {
    const count = db.prepare(`SELECT COUNT(*) as c FROM "${t.name}"`).get().c;
    console.log(`  ${t.name}: ${count} rows`);
  }
} else {
  console.log('File does not exist');
}
