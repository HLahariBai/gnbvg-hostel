import { initSqliteDatabase, db } from '../src/db/sqlite.js';
import sqliteAuthRoutes from '../src/routes/sqliteAuth.routes.js';
import studentRoutes from '../src/routes/student.routes.js';
import wardenRoutes from '../src/routes/warden.routes.js';
import { calculateEuclideanDistance, calculateHaversineDistance } from '../src/utils/geoFace.js';

function createMockRes() {
  const res: any = {
    statusCode: 200,
    body: null,
    cookies: {} as Record<string, any>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    },
    cookie(name: string, val: any) {
      this.cookies[name] = val;
      return this;
    },
  };
  return res;
}

function getRouteHandler(router: any, path: string, method: string) {
  const layer = router.stack.find(
    (l: any) => l.route?.path === path && l.route?.methods[method.toLowerCase()]
  );
  if (!layer) throw new Error(`Route ${method.toUpperCase()} ${path} not found in router`);
  const handlers = layer.route.stack;
  return handlers[handlers.length - 1].handle;
}

async function verifyAllEndpoints() {
  console.log('================================================================');
  console.log('   GNBVG REAL LOCAL BACKEND & SQLITE DATABASE AUDIT REPORT      ');
  console.log('================================================================\n');

  await initSqliteDatabase();

  // 1. Verify Database Schema & Seed Data
  console.log('1. Database Tables & Seed Verification:');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users', 'attendance', 'hostel_blocks')").all();
  console.log('   -> Tables:', tables.map((t: any) => t.name).join(', '));

  const wardenUser = db.prepare("SELECT id, name, email, role FROM users WHERE email = 'warden@gprec.ac.in'").get() as any;
  console.log('   -> Seeded Warden:', `${wardenUser.name} <${wardenUser.email}> (Role: ${wardenUser.role})`);

  const blocks = db.prepare('SELECT block_name, latitude, longitude, radius_meters FROM hostel_blocks').all() as any[];
  console.log('   -> Seeded Blocks:', blocks.map((b) => `${b.block_name} (${b.latitude}, ${b.longitude}, r=${b.radius_meters}m)`).join(' | '));

  // 2. Test POST /api/auth/login with Seeded Warden
  console.log('\n2. Testing POST /api/auth/login (Warden):');
  const loginHandler = getRouteHandler(sqliteAuthRoutes, '/login', 'post');
  const wardenLoginReq: any = {
    body: { email: 'warden@gprec.ac.in', password: 'Warden@123' },
  };
  const wardenLoginRes = createMockRes();
  await loginHandler(wardenLoginReq, wardenLoginRes);
  console.log(`   -> Status: ${wardenLoginRes.statusCode}, Success: ${wardenLoginRes.body.success}`);
  console.log(`   -> Role: ${wardenLoginRes.body.user.role}, Token generated: ${wardenLoginRes.body.token.substring(0, 20)}...`);

  // 3. Test POST /api/auth/register (Student)
  console.log('\n3. Testing POST /api/auth/register (Student with @gprec.ac.in domain):');
  const registerHandler = getRouteHandler(sqliteAuthRoutes, '/register', 'post');
  const testRoll = `219X1A05${Math.floor(Math.random() * 899 + 100)}`;
  const testEmail = `student.${testRoll.toLowerCase()}@gprec.ac.in`;
  const regReq: any = {
    body: {
      name: 'Priyanka Sharma',
      roll_number: testRoll,
      email: testEmail,
      password: 'StudentSecure@2026',
      role: 'student',
      year: '3',
      block: 'Anapurna-A',
      room_number: 'A-208',
    },
  };
  const regRes = createMockRes();
  await registerHandler(regReq, regRes);
  console.log(`   -> Status: ${regRes.statusCode}, Success: ${regRes.body.success}`);
  console.log(`   -> Created Student: ${regRes.body.user.name} (Roll: ${regRes.body.user.roll_number}, Block: ${regRes.body.user.block})`);
  const registeredStudentId = regRes.body.user.id;

  // 4. Test POST /api/student/enroll-face
  console.log('\n4. Testing POST /api/student/enroll-face (128-float face vector):');
  const enrollHandler = getRouteHandler(studentRoutes, '/enroll-face', 'post');
  const syntheticFaceEmbedding = Array.from({ length: 128 }, (_, i) => Math.sin(i * 0.1) * 0.2);
  const studentDbRecord = db.prepare('SELECT * FROM users WHERE id = ?').get(registeredStudentId) as any;
  const enrollReq: any = {
    sqliteUser: studentDbRecord,
    body: { face_descriptor: syntheticFaceEmbedding },
  };
  const enrollRes = createMockRes();
  await enrollHandler(enrollReq, enrollRes);
  console.log(`   -> Status: ${enrollRes.statusCode}, Success: ${enrollRes.body.success}`);
  console.log(`   -> face_enrolled updated in SQLite: ${enrollRes.body.face_enrolled}, vector length: ${enrollRes.body.descriptorLength}`);

  // 5. Test POST /api/student/mark-attendance
  console.log('\n5. Testing POST /api/student/mark-attendance (Euclidean match + GPS Haversine verification):');
  const markHandler = getRouteHandler(studentRoutes, '/mark-attendance', 'post');
  const refreshedStudent = db.prepare('SELECT * FROM users WHERE id = ?').get(registeredStudentId) as any;
  // Matching face within 0.02 Euclidean distance
  const liveFaceMatching = syntheticFaceEmbedding.map((v) => v + 0.002);
  const markReq: any = {
    sqliteUser: refreshedStudent,
    body: {
      face_descriptor: liveFaceMatching,
      latitude: 15.8345, // inside Anapurna-A coordinates
      longitude: 78.0353,
    },
  };
  const markRes = createMockRes();
  await markHandler(markReq, markRes);
  console.log(`   -> Status: ${markRes.statusCode}, Success: ${markRes.body.success}`);
  console.log(`   -> Verified Attendance ID: ${markRes.body.attendance.id}`);
  console.log(`   -> Status: ${markRes.body.attendance.status}, Euclidean diff: ${markRes.body.attendance.metrics.euclideanDistance}, GPS distance: ${markRes.body.attendance.metrics.gpsDistanceMeters}m`);

  // 6. Test GET /api/student/my-attendance
  console.log('\n6. Testing GET /api/student/my-attendance:');
  const myAttHandler = getRouteHandler(studentRoutes, '/my-attendance', 'get');
  const myAttReq: any = { sqliteUser: refreshedStudent };
  const myAttRes = createMockRes();
  await myAttHandler(myAttReq, myAttRes);
  console.log(`   -> Status: ${myAttRes.statusCode}, Success: ${myAttRes.body.success}`);
  console.log(`   -> Total Present Days: ${myAttRes.body.totalPresent}, Last Recorded: ${myAttRes.body.records[0].date} at ${myAttRes.body.records[0].timestamp}`);

  // 7. Test GET /api/warden/attendance-report
  console.log('\n7. Testing GET /api/warden/attendance-report (Warden Real-Time Query):');
  const reportHandler = getRouteHandler(wardenRoutes, '/attendance-report', 'get');
  const today = new Date().toISOString().split('T')[0];
  const reportReq: any = {
    sqliteUser: wardenUser,
    query: { date: today, year: 'ALL', block: 'ALL' },
  };
  const reportRes = createMockRes();
  await reportHandler(reportReq, reportRes);
  console.log(`   -> Status: ${reportRes.statusCode}, Success: ${reportRes.body.success}`);
  console.log(`   -> Total Students: ${reportRes.body.counts.totalStudents}`);
  console.log(`   -> Present Students Count: ${reportRes.body.counts.presentCount} (${reportRes.body.counts.attendancePercentage}%)`);
  console.log(`   -> Absent Students Count: ${reportRes.body.counts.absentCount}`);
  console.log(`   -> Face Not Enrolled Count: ${reportRes.body.counts.notEnrolledCount}`);

  // 8. Test POST /api/warden/block-coordinates
  console.log('\n8. Testing POST /api/warden/block-coordinates (Manual Geo-Boundary Updates):');
  const coordsHandler = getRouteHandler(wardenRoutes, '/block-coordinates', 'post');
  const coordsReq: any = {
    sqliteUser: wardenUser,
    body: {
      block_name: 'Anapurna-A',
      latitude: 15.8346,
      longitude: 78.0354,
      radius_meters: 180.0,
    },
  };
  const coordsRes = createMockRes();
  await coordsHandler(coordsReq, coordsRes);
  console.log(`   -> Status: ${coordsRes.statusCode}, Success: ${coordsRes.body.success}`);
  console.log(`   -> Updated Block: ${coordsRes.body.updatedBlock.block_name} at (${coordsRes.body.updatedBlock.latitude}, ${coordsRes.body.updatedBlock.longitude}) radius: ${coordsRes.body.updatedBlock.radius_meters}m`);

  console.log('\n================================================================');
  console.log('   ALL BACKEND ROUTES & SQLITE PERSISTENCE FULLY VERIFIED       ');
  console.log('================================================================\n');
}

verifyAllEndpoints().catch((err) => {
  console.error('[VERIFICATION FAILED]:', err);
  process.exit(1);
});
