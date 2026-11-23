import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function determineBlock(room: string): 'Anapurna-A' | 'Arundhathi-B' | 'Anuradha-C' {
  const r = room.toUpperCase().trim();
  if (r.startsWith('CO') || r.startsWith('C-') || r.startsWith('C0') || r.includes('(C)')) {
    return 'Anuradha-C';
  }
  if (r.startsWith('BO') || r.startsWith('BS') || r.startsWith('B') || r.startsWith('AD')) {
    return 'Arundhathi-B';
  }
  return 'Anapurna-A';
}

function cleanBranch(brn: string): string {
  const b = brn.toUpperCase().trim();
  if (b.includes('CSM')) return 'CSE-AIML (CSM)';
  if (b.includes('CSD')) return 'CSE-Data Science (CSD)';
  if (b.includes('CSE')) return 'Computer Science (CSE)';
  if (b.includes('ECE')) return 'Electronics & Comm (ECE)';
  if (b.includes('EEE')) return 'Electrical & Electronics (EEE)';
  if (b.includes('ME')) return 'Mechanical Engineering (ME)';
  if (b.includes('CE')) return 'Civil Engineering (CE)';
  return brn.replace(/^\d+\./, '');
}

interface ParsedStudent {
  roll_number: string;
  name: string;
  email: string;
  year: '1' | '2' | '3' | '4';
  block: 'Anapurna-A' | 'Arundhathi-B' | 'Anuradha-C';
  room_number: string;
  branch: string;
  student_phone: string;
  father_phone: string;
  mother_phone: string;
  hostel_id: string;
}

function parseLines(rawText: string, year: '1' | '2' | '3' | '4'): ParsedStudent[] {
  const lines = rawText.split('\n').filter((l) => l.trim().length > 0);
  const students: ParsedStudent[] = [];

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 8) continue;

    const rollNo = parts[1].toUpperCase();
    const hostelId = parts[parts.length - 1];
    const motherPhone = parts[parts.length - 2];
    const fatherPhone = parts[parts.length - 3];
    const studentPhone = parts[parts.length - 4];
    const branchRaw = parts[parts.length - 5];
    const roomNo = parts[parts.length - 6];

    const name = parts.slice(2, parts.length - 6).join(' ');
    const block = determineBlock(roomNo);
    const branch = cleanBranch(branchRaw);
    const email = `${rollNo.toLowerCase()}@gprec.ac.in`;

    students.push({
      roll_number: rollNo,
      name,
      email,
      year,
      block,
      room_number: roomNo,
      branch,
      student_phone: studentPhone,
      father_phone: fatherPhone,
      mother_phone: motherPhone,
      hostel_id: hostelId,
    });
  }

  return students;
}

export function main() {
  const dataDir = path.resolve(__dirname, '..', 'data');
  const ocrDir = path.join(dataDir, 'raw_ocr');

  // 1. Read existing First Year (2026 Batch) if present in students_roster.json
  let year1Students: ParsedStudent[] = [];
  const existingRosterPath = path.join(dataDir, 'students_roster.json');
  if (fs.existsSync(existingRosterPath)) {
    const existing = JSON.parse(fs.readFileSync(existingRosterPath, 'utf-8'));
    year1Students = existing.filter((s: any) => String(s.year) === '1');
  }

  // 2. Read Second Year (2025 Batch)
  const y2File = path.join(ocrDir, 'second_year_2025.txt');
  const y2Text = fs.readFileSync(y2File, 'utf-8');
  const year2Students = parseLines(y2Text, '2');

  // 3. Read Third Year (2024 Batch)
  const y3File = path.join(ocrDir, 'third_year_2024.txt');
  const y3Text = fs.readFileSync(y3File, 'utf-8');
  const year3Students = parseLines(y3Text, '3');

  // Combine and deduplicate by roll_number
  const map = new Map<string, ParsedStudent>();

  for (const s of year1Students) map.set(s.roll_number, s);
  for (const s of year2Students) map.set(s.roll_number, s);
  for (const s of year3Students) map.set(s.roll_number, s);

  const allStudents = Array.from(map.values());

  // Save to students_roster.json
  fs.writeFileSync(path.join(dataDir, 'students_roster.json'), JSON.stringify(allStudents, null, 2));

  // Save to students_roster.csv
  const csvHeaders = 'roll_number,name,year,block,room_number,branch,student_phone,father_phone,mother_phone,hostel_id,email\n';
  const csvRows = allStudents
    .map(
      (s) =>
        `"${s.roll_number}","${s.name}","${s.year}","${s.block}","${s.room_number}","${s.branch}","${s.student_phone}","${s.father_phone}","${s.mother_phone}","${s.hostel_id}","${s.email}"`
    )
    .join('\n');
  fs.writeFileSync(path.join(dataDir, 'students_roster.csv'), csvHeaders + csvRows);

  console.log(`\n================================================================`);
  console.log(`   FULL MULTI-BATCH HOSTEL ROSTER PARSED SUCCESSFULLY           `);
  console.log(`================================================================`);
  console.log(`-> First Year (2026 Batch):   ${year1Students.length} students`);
  console.log(`-> Second Year (2025 Batch):  ${year2Students.length} students`);
  console.log(`-> Third Year (2024 Batch):   ${year3Students.length} students`);
  console.log(`----------------------------------------------------------------`);
  console.log(`-> TOTAL ACTIVE HOSTEL STUDENTS: ${allStudents.length} records`);
  console.log(`================================================================\n`);
}

main();
