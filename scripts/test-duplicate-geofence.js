const http = require('http');

function postJSON(path, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 5000,
        path: path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, data: JSON.parse(body) });
          } catch (e) {
            resolve({ statusCode: res.statusCode, raw: body });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function run() {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync('database/gnbvg.db');

  console.log('====================================================');
  console.log('GNBVG ATTENDANCE VERIFICATION TEST SUITE');
  console.log('====================================================\n');

  const studentRow = db.prepare('SELECT * FROM users WHERE roll_number = ?').get('219X1A05393');
  const enrolledDescriptor = JSON.parse(studentRow.face_descriptor);

  // Generate vector with ~0.35 Euclidean distance (1st attempt)
  const vec1 = enrolledDescriptor.map((v, i) => v + (i % 2 === 0 ? 0.03 : -0.03));
  // Generate vector with ~0.15 Euclidean distance (2nd attempt - MUCH BETTER)
  const vecBetter = enrolledDescriptor.map((v, i) => v + (i % 2 === 0 ? 0.012 : -0.012));
  // Generate vector with ~0.40 Euclidean distance (3rd attempt - WORSE)
  const vecWorse = enrolledDescriptor.map((v, i) => v + (i % 2 === 0 ? 0.035 : -0.035));

  const baseStudent = {
    student_id: studentRow.id,
    roll_number: studentRow.roll_number,
    name: studentRow.name,
    year: studentRow.year,
    block: studentRow.block,
    room_number: studentRow.room_number,
  };

  // Clear existing records for today
  const todayStr = new Date().toISOString().split('T')[0];
  db.prepare('DELETE FROM attendance WHERE roll_number = ? AND date = ?').run(studentRow.roll_number, todayStr);
  db.prepare('UPDATE hostel_settings SET value = ? WHERE key = ?').run('open', 'frs_window_override');

  // TEST 1: Strict Geofence Rejection (Outside perimeter > 100m)
  console.log('--- TEST 1: Strict Geofence Rejection (Outside Hostel: ~1.2 km away) ---');
  const outsidePayload = {
    ...baseStudent,
    latitude: 15.78500, // ~1.2 km away from Anapurna-A
    longitude: 78.06500,
    face_descriptor: vec1,
  };
  const test1 = await postJSON('/api/attendance/mark', outsidePayload);
  console.log('Status Code:', test1.statusCode);
  console.log('Response Error:', test1.data.error);
  console.log('gpsDistance:', test1.data.gpsDistance, 'm, allowedRadius:', test1.data.allowedRadius, 'm');
  const test1Passed = test1.statusCode === 403 && test1.data.isOutsideGeofence === true;
  console.log('TEST 1 RESULT:', test1Passed ? 'PASSED (Strictly Blocked Beyond Geofence)' : 'FAILED');
  console.log('');

  // TEST 2: First Attendance Inside Geofence (Within perimeter, face match ~0.35)
  console.log('--- TEST 2: First Attendance Inside Geofence (Within perimeter, face distance ~0.35) ---');
  const insidePayload1 = {
    ...baseStudent,
    latitude: 15.77440, // Inside Anapurna-A geofence (~5m away)
    longitude: 78.05467,
    face_descriptor: vec1,
  };
  const test2 = await postJSON('/api/attendance/mark', insidePayload1);
  console.log('Status Code:', test2.statusCode);
  console.log('Response Message:', test2.data.message);
  console.log('isUpdate:', test2.data.isUpdate, 'bestAttempt:', test2.data.bestAttempt);
  const test2Passed = test2.statusCode === 200 && test2.data.success === true && !test2.data.isUpdate;
  console.log('TEST 2 RESULT:', test2Passed ? 'PASSED (Attendance Recorded)' : 'FAILED');
  console.log('');

  // TEST 3: Duplicate Submission With BETTER Match (face distance ~0.15)
  console.log('--- TEST 3: Duplicate Submission With BETTER Match (0.15 vs 0.35) ---');
  const insidePayloadBetter = {
    ...baseStudent,
    latitude: 15.77442,
    longitude: 78.05468,
    face_descriptor: vecBetter,
  };
  const test3 = await postJSON('/api/attendance/mark', insidePayloadBetter);
  console.log('Status Code:', test3.statusCode);
  console.log('Response Message:', test3.data.message);
  console.log('isUpdate:', test3.data.isUpdate, 'bestAttempt:', test3.data.bestAttempt);
  const test3Passed = test3.statusCode === 200 && test3.data.isUpdate === true && test3.data.bestAttempt === true;
  console.log('TEST 3 RESULT:', test3Passed ? 'PASSED (Best Record In-Place Updated)' : 'FAILED');
  console.log('');

  // TEST 4: Duplicate Submission With WORSE Match (face distance ~0.40)
  console.log('--- TEST 4: Duplicate Submission With WORSE Match (0.40 vs 0.15) ---');
  const insidePayloadWorse = {
    ...baseStudent,
    latitude: 15.77443,
    longitude: 78.05469,
    face_descriptor: vecWorse,
  };
  const test4 = await postJSON('/api/attendance/mark', insidePayloadWorse);
  console.log('Status Code:', test4.statusCode);
  console.log('Response Message:', test4.data.message);
  console.log('alreadyMarked:', test4.data.alreadyMarked, 'bestAttempt:', test4.data.bestAttempt);
  const test4Passed = test4.statusCode === 200 && test4.data.alreadyMarked === true && test4.data.bestAttempt === false;
  console.log('TEST 4 RESULT:', test4Passed ? 'PASSED (Existing Better Record Retained)' : 'FAILED');
  console.log('');

  // TEST 5: Verify in SQLite DB that only ONE row exists for today and has the best face_distance
  const rows = db.prepare('SELECT * FROM attendance WHERE roll_number = ? AND date = ?').all(studentRow.roll_number, todayStr);
  console.log('--- DATABASE INTEGRITY CHECK ---');
  console.log('Attendance Records Count for Today:', rows.length);
  console.log('Stored Face Distance in DB:', rows[0]?.face_distance);
  console.log('Stored GPS Distance in DB:', rows[0]?.gps_distance);
  const dbPassed = rows.length === 1 && rows[0].face_distance < 0.20;
  console.log('DB CHECK RESULT:', dbPassed ? 'PASSED (Zero duplicates, best record preserved in SQLite)' : 'FAILED');
  console.log('');

  // Reset override
  db.prepare('UPDATE hostel_settings SET value = ? WHERE key = ?').run('auto', 'frs_window_override');

  console.log('====================================================');
  console.log('FINAL SUMMARY:', test1Passed && test2Passed && test3Passed && test4Passed && dbPassed ? 'ALL 5 TESTS PASSED 100%!' : 'SOME TESTS FAILED');
  console.log('====================================================');
}

run().catch(console.error);
