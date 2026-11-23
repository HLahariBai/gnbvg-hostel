import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('database/gnbvg.db');
const rows = db.prepare("SELECT key, value FROM hostel_settings WHERE key LIKE '%frs%'").all();
console.log('FRS settings:', rows);
