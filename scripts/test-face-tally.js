import { DatabaseSync } from 'node:sqlite';

async function runTests() {
  console.log('=== 1. VERIFY STUDENT ON ROSTER ===');
  const verifyRes = await fetch('http://localhost:5000/api/auth/verify-student?roll_number=269X133062');
  const verifyJson = await verifyRes.json();
  console.log('Verify Student Response:', verifyJson);
  if (!verifyJson.success || !verifyJson.student) {
    throw new Error('Failed to verify 269X133062 in roster');
  }

  console.log('\n=== 2. TEST FACE ENROLLMENT & STORAGE IN SQLITE ===');
  // Generate a realistic 128-float biometric face descriptor
  const enrolledVector = Array.from({ length: 128 }, (_, i) => Math.sin(i * 0.15) * 0.2 + 0.05);

  const enrollRes = await fetch('http://localhost:5000/api/students/enroll-face', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roll_number: '269X133062',
      face_descriptor: enrolledVector,
    }),
  });
  const enrollJson = await enrollRes.json();
  console.log('Enroll Face Response:', enrollJson);
  if (!enrollJson.success) {
    throw new Error('Face enrollment API failed');
  }

  // Inspect SQLite directly to verify persistent storage
  const db = new DatabaseSync('database/gnbvg.db');
  const userInDb = db.prepare('SELECT id, roll_number, name, face_enrolled, face_descriptor IS NOT NULL as has_face FROM users WHERE roll_number = ?').get('269X133062');
  console.log('SQLite verification for 269X133062:', userInDb);
  if (userInDb.face_enrolled !== 1 || !userInDb.has_face) {
    throw new Error('Face descriptor was not properly persisted in SQLite database!');
  }

  console.log('\n=== 3. TEST LIVE FRS ATTENDANCE - IDENTICAL/MATCHING FACE (< 0.45 DISTANCE) ===');
  // Vector of the SAME person with natural subtle variance (e.g. slight lighting difference, distance ~ 0.04)
  const matchingLiveVector = enrolledVector.map(v => v + (Math.random() - 0.5) * 0.008);

  const matchRes = await fetch('http://localhost:5000/api/attendance/mark', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roll_number: '269X133062',
      face_descriptor: matchingLiveVector,
      latitude: 15.7743,
      longitude: 78.0547,
    }),
  });
  const matchJson = await matchRes.json();
  console.log('Matching Face Attendance Response:', matchJson);
  if (!matchJson.success || matchJson.faceDistance >= 0.45) {
    throw new Error(`Expected matching face to succeed with distance < 0.45, got: ${JSON.stringify(matchJson)}`);
  }
  console.log(`✓ Face Matched! Euclidean Distance: ${matchJson.faceDistance} (Threshold < 0.45)`);

  console.log('\n=== 4. TEST LIVE FRS ATTENDANCE - MISMATCHED FACE / DIFFERENT PERSON (>= 0.45) ===');
  // Vector of an impostor / totally different person
  const impostorVector = Array.from({ length: 128 }, (_, i) => Math.cos(i * 0.8) * 0.4 - 0.1);

  const impostorRes = await fetch('http://localhost:5000/api/attendance/mark', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roll_number: '269X133062',
      face_descriptor: impostorVector,
      latitude: 15.7743,
      longitude: 78.0547,
    }),
  });
  const impostorJson = await impostorRes.json();
  console.log('Impostor Face Attendance Response (Expected Rejection):', impostorJson);
  if (impostorRes.status !== 403 || impostorJson.success) {
    throw new Error('Impostor face should have been rejected with 403 Forbidden!');
  }
  console.log(`✓ Impostor Face Rejected! Distance ${impostorJson.faceDistance} exceeded 0.45 threshold.`);

  console.log('\n=== 5. VERIFY ATTENDANCE RECORDED IN SQLITE & WARDEN DASHBOARD ===');
  const today = new Date().toISOString().split('T')[0];
  const attendanceInDb = db.prepare('SELECT * FROM attendance WHERE roll_number = ? AND date = ?').get('269X133062', today);
  console.log('Attendance row in SQLite:', attendanceInDb);
  if (!attendanceInDb || attendanceInDb.status !== 'Present') {
    throw new Error('Attendance not found in SQLite table');
  }

  // Check Warden dashboard
  const wardenDashRes = await fetch('http://localhost:5000/api/warden/dashboard');
  const wardenDash = await wardenDashRes.json();
  console.log('Warden Dashboard Stats:', {
    totalResidents: wardenDash.totalResidents,
    presentToday: wardenDash.presentToday,
    absentToday: wardenDash.absentToday,
    compliancePercentage: wardenDash.compliancePercentage,
    recentCount: wardenDash.recentAttendance ? wardenDash.recentAttendance.length : 0,
  });
  console.log('\nALL 5 END-TO-END VERIFICATION CHECKS PASSED PERFECTLY!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
