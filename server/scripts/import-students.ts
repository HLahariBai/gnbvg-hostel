import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import argon2 from 'argon2';
import crypto from 'node:crypto';
import { db, initSqliteDatabase } from '../src/db/sqlite.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface StudentInput {
  roll_number: string;
  name: string;
  email?: string;
  year?: '1' | '2' | '3' | '4' | number | string;
  block?: string;
  room_number?: string | number;
  branch?: string;
  student_phone?: string;
  father_phone?: string;
  mother_phone?: string;
  hostel_id?: string | number;
  password?: string;
}

function normalizeBlock(rawBlock?: string): 'Anapurna-A' | 'Arundhathi-B' | 'Anuradha-C' {
  const b = String(rawBlock || '').trim().toLowerCase();
  if (b.includes('anuradha') || b.includes('co') || b.startsWith('c')) return 'Anuradha-C';
  if (b.includes('arundhathi') || b.includes('ad')) return 'Arundhathi-B';
  return 'Anapurna-A';
}

export async function importStudentsRoster(filePath?: string): Promise<void> {
  await initSqliteDatabase();

  const dataDir = path.resolve(__dirname, '..', 'data');
  const jsonPath = filePath || path.join(dataDir, 'students_roster.json');
  const csvPath = path.join(dataDir, 'students_roster.csv');

  let students: StudentInput[] = [];

  if (fs.existsSync(jsonPath)) {
    console.log(`[IMPORT] Reading student records from JSON: ${jsonPath}`);
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    students = JSON.parse(raw);
  } else if (fs.existsSync(csvPath)) {
    console.log(`[IMPORT] Reading student records from CSV: ${csvPath}`);
    const lines = fs.readFileSync(csvPath, 'utf-8').split(/\r?\n/).filter((l) => l.trim().length > 0);
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.replace(/^"|"$/g, '').trim());
      if (cols.length >= 5) {
        students.push({
          roll_number: cols[0],
          name: cols[1],
          year: cols[2],
          block: cols[3],
          room_number: cols[4],
          branch: cols[5],
          student_phone: cols[6],
          father_phone: cols[7],
          mother_phone: cols[8],
          hostel_id: cols[9],
          email: cols[10],
        });
      }
    }
  } else {
    console.error(`\n[ERROR] No student roster file found in ${dataDir}`);
    return;
  }

  console.log(`[IMPORT] Found ${students.length} student records to import/update.`);

  // Prepare standard default student password hash (Student@123)
  const defaultPasswordHash = await argon2.hash('Student@123', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const upsertStmt = db.prepare(`
    INSERT INTO users (
      id, name, roll_number, email, password_hash, role, year, block, room_number,
      branch, student_phone, father_phone, mother_phone, hostel_id,
      face_enrolled, face_descriptor
    ) VALUES (
      ?, ?, ?, ?, ?, 'student', ?, ?, ?,
      ?, ?, ?, ?, ?,
      0, NULL
    )
    ON CONFLICT(roll_number) DO UPDATE SET
      name = excluded.name,
      email = excluded.email,
      year = excluded.year,
      block = excluded.block,
      room_number = excluded.room_number,
      branch = excluded.branch,
      student_phone = excluded.student_phone,
      father_phone = excluded.father_phone,
      mother_phone = excluded.mother_phone,
      hostel_id = excluded.hostel_id
  `);

  let insertedCount = 0;
  let updatedCount = 0;

  db.exec('BEGIN TRANSACTION;');

  try {
    for (const s of students) {
      if (!s.roll_number || !s.name) continue;

      const roll = s.roll_number.trim().toUpperCase();
      const name = s.name.trim();
      const year = String(s.year || '1').trim();
      const block = normalizeBlock(s.block || String(s.room_number || ''));
      const room = String(s.room_number || '').trim();
      const branch = s.branch ? String(s.branch).trim() : null;
      const studentPhone = s.student_phone ? String(s.student_phone).trim() : null;
      const fatherPhone = s.father_phone ? String(s.father_phone).trim() : null;
      const motherPhone = s.mother_phone ? String(s.mother_phone).trim() : null;
      const hostelId = s.hostel_id ? String(s.hostel_id).trim() : null;
      const email = s.email && s.email.includes('@gprec.ac.in')
        ? s.email.trim().toLowerCase()
        : `${roll.toLowerCase()}@gprec.ac.in`;

      const existing = db.prepare('SELECT id FROM users WHERE roll_number = ?').get(roll);

      if (existing) {
        upsertStmt.run(
          (existing as any).id,
          name,
          roll,
          email,
          defaultPasswordHash,
          year,
          block,
          room,
          branch,
          studentPhone,
          fatherPhone,
          motherPhone,
          hostelId
        );
        updatedCount++;
      } else {
        const id = `usr-${crypto.randomUUID()}`;
        upsertStmt.run(
          id,
          name,
          roll,
          email,
          defaultPasswordHash,
          year,
          block,
          room,
          branch,
          studentPhone,
          fatherPhone,
          motherPhone,
          hostelId
        );
        insertedCount++;
      }
    }

    db.exec('COMMIT;');
    console.log(`\n================================================================`);
    console.log(`   ROSTER IMPORT SUCCESS: ${insertedCount} inserted, ${updatedCount} updated.`);
    console.log(`================================================================\n`);

    // 1. Breakdown by Academic Year & Hostel Block
    console.log('1. Hostel Students by Year & Assigned Block:');
    const summaryStmt = db.prepare(`
      SELECT year as "Academic Year", block as "Hostel Block", COUNT(*) as "Total Students"
      FROM users
      WHERE role = 'student'
      GROUP BY year, block
      ORDER BY year ASC, block ASC
    `);
    console.table(summaryStmt.all());

    // 2. Breakdown by Engineering Branch
    console.log('\n2. Students by Department / Branch:');
    const branchStmt = db.prepare(`
      SELECT COALESCE(branch, 'Unassigned') as "Branch", COUNT(*) as "Students"
      FROM users
      WHERE role = 'student'
      GROUP BY branch
      ORDER BY COUNT(*) DESC
    `);
    console.table(branchStmt.all());

    // 3. Verification Query Sample: First 5 Students with Parent Contacts
    console.log('\n3. Sample Student Records with Parent Contact Telemetry:');
    const sampleStmt = db.prepare(`
      SELECT roll_number, name, room_number, block, branch, student_phone, father_phone, hostel_id
      FROM users
      WHERE role = 'student'
      ORDER BY roll_number ASC
      LIMIT 5
    `);
    console.table(sampleStmt.all());
  } catch (err) {
    db.exec('ROLLBACK;');
    console.error('[IMPORT FAILED] Rolled back database transaction:', err);
  }
}

if (process.argv[1] && process.argv[1].endsWith('import-students.ts')) {
  importStudentsRoster().catch(console.error);
}
