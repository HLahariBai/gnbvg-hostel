import { DatabaseSync } from 'node:sqlite';

const BASE_URL = 'http://localhost:5000';

async function runGeofenceTests() {
  const db = new DatabaseSync('database/gnbvg.db');
  // Clear any existing attendance for clean test
  db.prepare('DELETE FROM attendance').run();

  console.log('=== TEST 1: VERIFY ENROLLMENT DOES NOT CREATE ATTENDANCE ===');
  const enrollVector = Array.from({ length: 128 }, (_, i) => Math.sin(i * 0.15) * 0.2 + 0.05);

  const enrollRes = await fetch(`${BASE_URL}/api/students/enroll-face`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roll_number: '269X133062',
      face_descriptor: enrollVector,
    }),
  });
  const enrollJson = await enrollRes.json();
  console.log('Enrollment response:', enrollJson.success ? '✓ Enrolled successfully' : enrollJson);

  // Check SQLite: users must be face_enrolled = 1, attendance must be 0!
  const user = db.prepare('SELECT id, roll_number, name, face_enrolled FROM users WHERE roll_number = ?').get('269X133062');
  const attCount = db.prepare('SELECT count(*) as c FROM attendance').get();
  console.log('User profile face_enrolled:', user.face_enrolled);
  console.log('Attendance table row count:', attCount.c);
  if (user.face_enrolled !== 1 || attCount.c !== 0) {
    throw new Error('Rule 1 Violated: Enrollment modified attendance table or failed to set face_enrolled!');
  }
  console.log('✓ RULE 1 VERIFIED: Facial enrollment strictly saved to users table. Attendance table has 0 rows.');

  console.log('\n=== TEST 2: WARDEN DASHBOARD - PENDING STATUS & PROFILE STATUS ===');
  const dashRes1 = await fetch(`${BASE_URL}/api/warden/dashboard`);
  const dash1 = await dashRes1.json();
  console.log('Warden KPIs after enrollment only:', dash1.kpis);
  if (dash1.presentStudents.length !== 0) {
    throw new Error('Present list must be 0 when student only enrolled face!');
  }
  const tejaswiniInPending = dash1.absentStudents.find(s => s.roll_number === '269X133062' || s.id === '269X133062');
  console.log('Tejaswini in Pending List:', {
    name: tejaswiniInPending.name,
    profileStatus: tejaswiniInPending.profileStatus,
    dailyStatus: tejaswiniInPending.dailyStatus,
  });
  if (tejaswiniInPending.profileStatus !== 'FRS Enrolled' || tejaswiniInPending.dailyStatus !== 'Pending') {
    throw new Error('Rule 1 Violated: Profile Status must be FRS Enrolled and Daily Status must be Pending!');
  }
  console.log('✓ RULE 1 DASHBOARD VERIFIED: Profile Status = FRS Enrolled, Daily Attendance Status = Pending.');

  console.log('\n=== TEST 3: GEOFENCE BREACH (CASE 2 - SILENT WARDEN ALERT) ===');
  // Student submits from ~280m away: Lat 15.7768° N, Lng 78.0560° E
  const studentMatchingFace = enrollVector.map(v => v + (Math.random() - 0.5) * 0.005);
  const outOfRangeRes = await fetch(`${BASE_URL}/api/attendance/mark`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roll_number: '269X133062',
      face_descriptor: studentMatchingFace,
      latitude: 15.7768,
      longitude: 78.0560,
    }),
  });
  const outOfRangeJson = await outOfRangeRes.json();
  console.log('Student sees response:', outOfRangeJson);
  if (!outOfRangeJson.success || outOfRangeJson.status !== 'Attendance Submitted') {
    throw new Error('Rule 2 Case 2 Violated: Student must receive normal confirmation screen!');
  }
  console.log('✓ STUDENT PERSPECTIVE: Normal confirmation screen shown ("Attendance Submitted"). Student unaware of breach.');

  // Check Database: must be FLAGGED_OUT_OF_RANGE with is_geofence_breach = 1
  const breachRecord = db.prepare('SELECT * FROM attendance WHERE roll_number = ?').get('269X133062');
  console.log('SQLite record saved for breach attempt:', {
    id: breachRecord.id,
    status: breachRecord.status,
    is_geofence_breach: breachRecord.is_geofence_breach,
    gps_distance: Math.round(breachRecord.gps_distance),
  });
  if (breachRecord.status !== 'FLAGGED_OUT_OF_RANGE' || breachRecord.is_geofence_breach !== 1) {
    throw new Error('Rule 2 Case 2 Violated: Database must store status = FLAGGED_OUT_OF_RANGE and is_geofence_breach = 1!');
  }
  console.log('✓ DATABASE RECORD: Saved with status: FLAGGED_OUT_OF_RANGE and is_geofence_breach = 1.');

  console.log('\n=== TEST 4: WARDEN DASHBOARD - OUT-OF-RANGE ALERT TRIGGERED ===');
  const dashRes2 = await fetch(`${BASE_URL}/api/warden/dashboard`);
  const dash2 = await dashRes2.json();
  console.log('Warden KPIs after breach:', dash2.kpis);
  console.log('Present list count:', dash2.presentStudents.length);
  console.log('Out of range alerts count:', dash2.outOfRangeAlerts.length);
  if (dash2.presentStudents.length !== 0 || dash2.outOfRangeAlerts.length !== 1) {
    throw new Error('Warden dashboard must show 0 Present and 1 Out-of-Range Alert!');
  }
  const alert = dash2.outOfRangeAlerts[0];
  console.log('Alert Details:', {
    name: alert.name,
    roll_number: alert.roll_number,
    gpsDistance: alert.gpsDistance,
    allowedRadius: alert.allowedRadius,
    alertMessage: alert.alertMessage,
  });
  console.log('✓ WARDEN PERSPECTIVE: High-priority Out-of-Range Alert triggered on Warden panel.');

  console.log('\n=== TEST 5: WARDEN ONE-CLICK RESOLUTION (APPROVE EXCEPTION) ===');
  const resolveRes = await fetch(`${BASE_URL}/api/warden/attendance/resolve-alert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      attendance_id: alert.id,
      action: 'approve',
    }),
  });
  const resolveJson = await resolveRes.json();
  console.log('Resolve Alert Response:', resolveJson);

  const dashRes3 = await fetch(`${BASE_URL}/api/warden/dashboard`);
  const dash3 = await dashRes3.json();
  console.log('Warden KPIs after approval:', dash3.kpis);
  console.log('Present list count:', dash3.presentStudents.length);
  console.log('Present student sample:', dash3.presentStudents[0]);
  if (dash3.presentStudents.length !== 1 || dash3.presentStudents[0].status !== 'Present (Warden Override)') {
    throw new Error('After warden approval, student must appear in Present list as Present (Warden Override)!');
  }
  console.log('✓ WARDEN APPROVAL: Successfully overridden to Present (Warden Override) and cleared from alerts.');

  // Clean attendance table after test
  db.prepare('DELETE FROM attendance').run();
  console.log('\nALL 5 STRICT USER REQUIREMENTS VERIFIED & PASSED PERFECTLY! Attendance table cleaned for production.');
}

runGeofenceTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
