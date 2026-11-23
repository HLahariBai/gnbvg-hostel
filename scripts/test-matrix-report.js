import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('database/gnbvg.db');

function generateMatrixReport(numDays = 15, endDateStr = new Date().toISOString().split('T')[0]) {
  const dates = [];
  const end = new Date(endDateStr);
  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }

  // Fetch all active students
  const students = db.prepare(`
    SELECT roll_number, name, year, block, room_number
    FROM users
    WHERE role = 'student'
    ORDER BY year ASC, block ASC, roll_number ASC
  `).all();

  // Fetch all attendance records across this window
  const attRows = db.prepare(`
    SELECT roll_number, date, status
    FROM attendance
    WHERE date >= ? AND date <= ?
  `).all(dates[0], dates[dates.length - 1]);

  const attMap = new Set();
  attRows.forEach(r => {
    if (r.status && r.status.toLowerCase().includes('present')) {
      attMap.add(`${r.roll_number}_${r.date}`);
    }
  });

  // Fetch approved outpasses
  const outpasses = db.prepare(`
    SELECT roll_number, from_date, to_date
    FROM outpasses
    WHERE status = 'Approved'
      AND to_date >= ? AND from_date <= ?
  `).all(dates[0], dates[dates.length - 1]);

  function isStudentOnLeave(roll, dateStr) {
    return outpasses.some(o => o.roll_number === roll && o.from_date <= dateStr && o.to_date >= dateStr);
  }

  // Build CSV
  // Header: Roll Number,Name,Year,Hostel Block,Room,01/11/26,02/11/26...,Total Days,P,A,L,%
  const dateHeaders = dates.map(d => {
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y.slice(-2)}`;
  });

  let csv = `Roll Number,Student Name,Year,Hostel Block,Room,${dateHeaders.join(',')},Total Days,Present (P),Absent (A),On Leave (L),Attendance %\n`;

  for (const s of students) {
    let pCount = 0;
    let aCount = 0;
    let lCount = 0;
    const dayStatuses = [];

    for (const d of dates) {
      if (attMap.has(`${s.roll_number}_${d}`)) {
        dayStatuses.push('P');
        pCount++;
      } else if (isStudentOnLeave(s.roll_number, d)) {
        dayStatuses.push('L');
        lCount++;
      } else {
        dayStatuses.push('A');
        aCount++;
      }
    }

    const effectiveTotal = numDays;
    const pct = Math.round((pCount / (effectiveTotal || 1)) * 100);
    const yrLabel = s.year === '1' ? '1st Year' : s.year === '2' ? '2nd Year' : s.year === '3' ? '3rd Year' : (s.year || '1st Year');

    csv += `${s.roll_number},"${s.name}",${yrLabel},${s.block || '--'},${s.room_number || '--'},${dayStatuses.join(',')},${numDays},${pCount},${aCount},${lCount},${pct}%\n`;
  }

  return { dates, studentCount: students.length, csvLines: csv.split('\n').length, sampleRow: csv.split('\n')[1] };
}

const res = generateMatrixReport(15);
console.log('Generated Matrix Report Test:');
console.log('Dates (15 days):', res.dates);
console.log('Students:', res.studentCount);
console.log('CSV Lines:', res.csvLines);
console.log('Sample Row 1:', res.sampleRow);
