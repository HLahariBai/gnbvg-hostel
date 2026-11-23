import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('database/gnbvg.db');

db.prepare("INSERT OR REPLACE INTO hostel_settings (key, value) VALUES ('frs_start_time', '17:00')").run();
db.prepare("INSERT OR REPLACE INTO hostel_settings (key, value) VALUES ('frs_end_time', '19:00')").run();
db.prepare("INSERT OR REPLACE INTO hostel_settings (key, value) VALUES ('frs_window_override', 'auto')").run();

const rows = db.prepare("SELECT key, value FROM hostel_settings WHERE key LIKE '%frs%'").all();
console.log('Updated FRS settings in DB:', rows);
