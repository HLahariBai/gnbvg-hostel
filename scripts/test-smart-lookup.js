import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('database/gnbvg.db');

export function findStudentInRoster(query) {
  if (!query) return null;
  const clean = String(query).trim().toUpperCase().replace(/[\s\-_]/g, '');

  // 1. Exact roll number match
  let student = db.prepare('SELECT * FROM users WHERE UPPER(roll_number) = ?').get(clean);
  if (student) return student;

  // 2. Common GPREC typo: 269X1... -> 269XA... (swapping '1' and 'A')
  if (clean.includes('X1')) {
    const swapped = clean.replace('X1', 'XA');
    student = db.prepare('SELECT * FROM users WHERE UPPER(roll_number) = ?').get(swapped);
    if (student) return student;
  }
  if (clean.includes('XA')) {
    const swapped = clean.replace('XA', 'X1A');
    student = db.prepare('SELECT * FROM users WHERE UPPER(roll_number) = ?').get(swapped);
    if (student) return student;
  }

  // 3. Suffix match (e.g. '33062' or last 5-6 characters)
  if (clean.length >= 4) {
    const suffix = clean.slice(-5);
    student = db.prepare('SELECT * FROM users WHERE roll_number LIKE ? LIMIT 1').get(`%${suffix}`);
    if (student) return student;
  }

  // 4. Email match
  const emailClean = String(query).trim().toLowerCase();
  student = db.prepare('SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(email) = ?').get(emailClean, `${emailClean}@gprec.ac.in`);
  if (student) return student;

  // 5. Name match (e.g. "HANCHATE SAI TEJASWINI" -> matches "H. SAI TEJASWINI")
  const words = String(query).trim().toUpperCase().split(/\s+/).filter(w => w.length > 2);
  if (words.length > 0) {
    const lastWord = words[words.length - 1]; // e.g. "TEJASWINI"
    const candidates = db.prepare('SELECT * FROM users WHERE UPPER(name) LIKE ?').all(`%${lastWord}%`);
    for (const cand of candidates) {
      if (words.some(w => cand.name.toUpperCase().includes(w))) {
        return cand;
      }
    }
    if (candidates.length > 0) return candidates[0];
  }

  return null;
}

const test1 = findStudentInRoster('269X133062');
console.log('Result for 269X133062:', test1 ? `${test1.roll_number} - ${test1.name} (${test1.email})` : 'NOT FOUND');

const test2 = findStudentInRoster('HANCHATE SAI TEJASWINI');
console.log('Result for HANCHATE SAI TEJASWINI:', test2 ? `${test2.roll_number} - ${test2.name} (${test2.email})` : 'NOT FOUND');

const test3 = findStudentInRoster('269XA33062');
console.log('Result for 269XA33062:', test3 ? `${test3.roll_number} - ${test3.name} (${test3.email})` : 'NOT FOUND');
