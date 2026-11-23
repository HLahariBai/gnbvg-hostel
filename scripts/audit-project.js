import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

console.log('====================================================');
console.log('   FULL PROJECT AUDIT & SYSTEM CHECKLIST REPORT');
console.log('====================================================\n');

// 1. Audit Database
const dbPath = path.resolve('database/gnbvg.db');
const dbStats = fs.statSync(dbPath);
console.log(`[DATABASE] File: ${dbPath} (${(dbStats.size / 1024).toFixed(2)} KB)`);

const db = new DatabaseSync('database/gnbvg.db');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables present:', tables.map(t => t.name).join(', '));

const studentCount = db.prepare("SELECT count(id) as c FROM users WHERE role='student'").get().c;
const wardenCount = db.prepare("SELECT count(id) as c FROM users WHERE role IN ('warden','admin')").get().c;
const attendanceCount = db.prepare("SELECT count(id) as c FROM attendance").get().c;
const outpassCount = db.prepare("SELECT count(id) as c FROM outpasses").get().c;
const ticketCount = db.prepare("SELECT count(id) as c FROM maintenance_tickets").get().c;
const enrolledCount = db.prepare("SELECT count(id) as c FROM users WHERE face_enrolled=1").get().c;

console.log(`- Official Admitted Students on Roster: ${studentCount}`);
console.log(`- Wardens / Administrators: ${wardenCount}`);
console.log(`- Face Enrolled Residents: ${enrolledCount}`);
const enrolledResidents = db.prepare("SELECT roll_number, name, email, is_activated FROM users WHERE face_enrolled=1").all();
enrolledResidents.forEach(r => console.log(`    * ${r.roll_number} - ${r.name} (${r.email})`));
console.log(`- Current Attendance Records Today: ${attendanceCount}`);
console.log(`- Current Outpasses: ${outpassCount}`);
console.log(`- Current Maintenance Tickets: ${ticketCount}`);

// Check 1st year roll format
const firstYearsSample = db.prepare("SELECT roll_number, email FROM users WHERE role='student' AND year='1' LIMIT 5").all();
console.log('\n[1ST YEAR ROSTER SAMPLE - Roll & Email Format]:');
firstYearsSample.forEach(s => console.log(`  ${s.roll_number} -> ${s.email}`));

// Check settings
const settings = db.prepare("SELECT key, value FROM hostel_settings").all();
console.log('\n[HOSTEL SETTINGS]:');
settings.forEach(s => console.log(`  ${s.key}: ${s.value}`));

// Check Blocks & Coordinates
const blocks = db.prepare("SELECT * FROM hostel_blocks").all();
console.log('\n[HOSTEL BLOCKS GEOFENCE CONFIG]:');
blocks.forEach(b => console.log(`  ${b.block_name}: Lat=${b.latitude}, Lng=${b.longitude}, Radius=${b.radius_meters}m`));

// Check Warden accounts
const wardens = db.prepare("SELECT id, name, email, role, roll_number FROM users WHERE role IN ('warden', 'admin')").all();
console.log('\n[WARDEN / ADMIN ACCOUNTS]:');
wardens.forEach(w => console.log(`  ${w.name} (${w.role}) -> ${w.email}`));

// 2. Audit Models (Face-API)
const modelsDir = path.resolve('client/public/models');
if (fs.existsSync(modelsDir)) {
  const modelFiles = fs.readdirSync(modelsDir);
  console.log(`\n[FACE-API MODELS]: Found ${modelFiles.length} files in ${modelsDir}`);
  modelFiles.forEach(f => console.log(`  - ${f}`));
} else {
  console.log('\n[FACE-API MODELS]: DIRECTORY MISSING!');
}

// 3. Audit Client Build
const distDir = path.resolve('client/dist');
if (fs.existsSync(distDir)) {
  const distFiles = fs.readdirSync(distDir);
  console.log(`\n[CLIENT DIST BUILD]: Found ${distFiles.length} files/dirs in ${distDir}`);
} else {
  console.log('\n[CLIENT DIST BUILD]: client/dist MISSING!');
}

// 4. Audit Server
const serverIndexPath = path.resolve('server/index.js');
console.log(`\n[SERVER ENTRYPOINT]: server/index.js (${fs.statSync(serverIndexPath).size} bytes)`);

// 5. Audit College Package
const collegeBat = path.resolve('START-COLLEGE-HOSTEL.bat');
console.log(`[COLLEGE LAUNCH BAT]: START-COLLEGE-HOSTEL.bat (${fs.existsSync(collegeBat) ? 'READY' : 'MISSING'})`);
