import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('database/gnbvg.db');
db.prepare("UPDATE hostel_settings SET value = 'open' WHERE key = 'frs_window_override'").run();
console.log('Updated frs_window_override to open');
