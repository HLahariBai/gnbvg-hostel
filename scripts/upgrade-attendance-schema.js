import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('database/gnbvg.db');

const cols = db.prepare('PRAGMA table_info(attendance)').all().map(c => c.name);

if (!cols.includes('is_geofence_breach')) {
  db.exec('ALTER TABLE attendance ADD COLUMN is_geofence_breach INTEGER DEFAULT 0;');
  console.log('Added is_geofence_breach column');
}
if (!cols.includes('warden_action')) {
  db.exec('ALTER TABLE attendance ADD COLUMN warden_action TEXT DEFAULT NULL;');
  console.log('Added warden_action column');
}
if (!cols.includes('warden_action_at')) {
  db.exec('ALTER TABLE attendance ADD COLUMN warden_action_at TEXT DEFAULT NULL;');
  console.log('Added warden_action_at column');
}

console.log('Final attendance columns:', db.prepare('PRAGMA table_info(attendance)').all().map(c => c.name));
