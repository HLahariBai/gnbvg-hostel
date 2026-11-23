import test, { describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { db, initSqliteDatabase } from '../db/sqlite.js';
import sqliteAuthRoutes from '../routes/sqliteAuth.routes.js';
import studentRoutes from '../routes/student.routes.js';
import wardenRoutes from '../routes/warden.routes.js';

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
    send(data: any) {
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

describe('Local Persistent SQLite Database & Full-Stack Backend API Tests', () => {
  let studentId = '';

  // Generate synthetic 128-dimensional face embedding vectors
  const baseVector = Array.from({ length: 128 }, (_, i) => Math.sin(i) * 0.1);
  // Slightly perturbed vector (Euclidean distance ~ 0.05 < 0.60)
  const matchingVector = baseVector.map((val) => val + 0.005);
  // Completely different vector (Euclidean distance > 0.80)
  const differentVector = Array.from({ length: 128 }, (_, i) => Math.cos(i) * 0.5);

  before(async () => {
    await initSqliteDatabase();
  });

  test('1. Database Tables and Default Seed Verification', async () => {
    // Check tables exist
    const tablesStmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users', 'attendance', 'hostel_blocks')");
    const tables = tablesStmt.all() as Array<{ name: string }>;
    const tableNames = tables.map((t) => t.name);

    assert.ok(tableNames.includes('users'), 'Table users must exist');
    assert.ok(tableNames.includes('attendance'), 'Table attendance must exist');
    assert.ok(tableNames.includes('hostel_blocks'), 'Table hostel_blocks must exist');

    // Check default blocks
    const blocksStmt = db.prepare('SELECT block_name, latitude, longitude, radius_meters FROM hostel_blocks ORDER BY block_name');
    const blocks = blocksStmt.all() as Array<{ block_name: string; latitude: number; longitude: number; radius_meters: number }>;
    assert.ok(blocks.length >= 3, 'Must have at least 3 default hostel blocks seeded');

    const blockNames = blocks.map((b) => b.block_name);
    assert.ok(blockNames.includes('Anapurna-A'));
    assert.ok(blockNames.includes('Arundhathi-B'));
    assert.ok(blockNames.includes('Anuradha-C'));

    // Check seeded warden exists
    const warden = db.prepare('SELECT id, email, role FROM users WHERE email = ?').get('warden@gprec.ac.in') as { id: string; email: string; role: string };
    assert.ok(warden, 'Default warden must be seeded in SQLite');
    assert.equal(warden.role, 'warden');
  });

  test('2. Warden Login with Default Seeded Credentials (warden@gprec.ac.in / Warden@123)', async () => {
    const loginHandler = getRouteHandler(sqliteAuthRoutes, '/login', 'post');

    const req: any = {
      body: {
        email: 'warden@gprec.ac.in',
        password: 'Warden@123',
      },
    };
    const res = createMockRes();
    await loginHandler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.user.role, 'warden');
    assert.ok(res.body.token, 'Must return JWT token');
  });

  test('3. Student Registration with Institutional Domain Enforcement (@gprec.ac.in)', async () => {
    const registerHandler = getRouteHandler(sqliteAuthRoutes, '/register', 'post');

    // Reject non-institutional email
    const badReq: any = {
      body: {
        name: 'Test Student',
        roll_number: '219X1A0599',
        email: 'student@gmail.com',
        password: 'Password@123',
        role: 'student',
        year: '3',
        block: 'Anapurna-A',
        room_number: 'A-204',
      },
    };
    const badRes = createMockRes();
    await registerHandler(badReq, badRes);

    assert.equal(badRes.statusCode, 400);
    assert.match(badRes.body.error, /@gprec\.ac\.in/i);

    // Register valid GPREC student
    const timestamp = Date.now();
    const validReq: any = {
      body: {
        name: 'Lakshmi Prasanna',
        roll_number: `219X1A05${timestamp % 1000}`,
        email: `student.${timestamp}@gprec.ac.in`,
        password: 'SecureStudent@2026',
        role: 'student',
        year: '3',
        block: 'Anapurna-A',
        room_number: 'A-301',
      },
    };
    const validRes = createMockRes();
    await registerHandler(validReq, validRes);

    assert.equal(validRes.statusCode, 201);
    assert.equal(validRes.body.success, true);
    assert.equal(validRes.body.user.role, 'student');
    assert.equal(validRes.body.user.face_enrolled, false);
    assert.ok(validRes.body.token);

    studentId = validRes.body.user.id;
  });

  test('4. Facial Descriptor Enrollment (POST /api/student/enroll-face)', async () => {
    const enrollHandler = getRouteHandler(studentRoutes, '/enroll-face', 'post');

    const studentRecord = db.prepare('SELECT * FROM users WHERE id = ?').get(studentId) as any;
    assert.ok(studentRecord, `Student record must exist for id: ${studentId}`);

    const req: any = {
      sqliteUser: studentRecord,
      body: {
        face_descriptor: baseVector,
      },
    };
    const res = createMockRes();

    await enrollHandler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.face_enrolled, true);

    // Verify persisted in SQLite
    const userInDb = db.prepare('SELECT face_enrolled, face_descriptor FROM users WHERE id = ?').get(studentId) as { face_enrolled: number; face_descriptor: string };
    assert.equal(userInDb.face_enrolled, 1);
    assert.ok(userInDb.face_descriptor);
    const parsed = JSON.parse(userInDb.face_descriptor);
    assert.equal(parsed.length, 128);
  });

  test('5. Attendance Verification: Euclidean Distance & Geofence Checks', async () => {
    const markHandler = getRouteHandler(studentRoutes, '/mark-attendance', 'post');
    const studentRecord = db.prepare('SELECT * FROM users WHERE id = ?').get(studentId) as any;

    // 5a. Reject mismatched face (> 0.60 Euclidean distance)
    const mismatchedReq: any = {
      sqliteUser: studentRecord,
      body: {
        face_descriptor: differentVector,
        latitude: 15.8344, // inside Anapurna-A
        longitude: 78.0352,
      },
    };
    const mismatchedRes = createMockRes();
    await markHandler(mismatchedReq, mismatchedRes);

    assert.equal(mismatchedRes.statusCode, 403);
    assert.match(mismatchedRes.body.error, /Facial verification failed/i);

    // 5b. Reject out-of-boundary GPS coordinates (> 150m away from Anapurna-A)
    const outOfBoundsReq: any = {
      sqliteUser: studentRecord,
      body: {
        face_descriptor: matchingVector,
        latitude: 15.8500, // ~1.7 km away
        longitude: 78.0500,
      },
    };
    const outOfBoundsRes = createMockRes();
    await markHandler(outOfBoundsReq, outOfBoundsRes);

    assert.equal(outOfBoundsRes.statusCode, 403);
    assert.match(outOfBoundsRes.body.error, /Geofence violation/i);

    // 5c. Successfully mark attendance (valid face + valid GPS within block)
    const successReq: any = {
      sqliteUser: studentRecord,
      body: {
        face_descriptor: matchingVector,
        latitude: 15.8344,
        longitude: 78.0352,
      },
    };
    const successRes = createMockRes();
    await markHandler(successReq, successRes);

    assert.equal(successRes.statusCode, 201);
    assert.equal(successRes.body.success, true);
    assert.equal(successRes.body.attendance.status, 'Present');
    assert.equal(successRes.body.attendance.block, 'Anapurna-A');

    // 5d. Duplicate attendance rejection on same date
    const duplicateRes = createMockRes();
    await markHandler(successReq, duplicateRes);

    assert.equal(duplicateRes.statusCode, 409);
    assert.match(duplicateRes.body.error, /already been recorded/i);
  });

  test('6. Student Attendance History (GET /api/student/my-attendance)', async () => {
    const historyHandler = getRouteHandler(studentRoutes, '/my-attendance', 'get');
    const studentRecord = db.prepare('SELECT * FROM users WHERE id = ?').get(studentId) as any;

    const req: any = {
      sqliteUser: studentRecord,
    };
    const res = createMockRes();
    await historyHandler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.totalPresent, 1);
    assert.equal(res.body.records[0].status, 'Present');
  });

  test('7. Warden Attendance Report (GET /api/warden/attendance-report)', async () => {
    const reportHandler = getRouteHandler(wardenRoutes, '/attendance-report', 'get');
    const wardenRecord = db.prepare('SELECT * FROM users WHERE email = ?').get('warden@gprec.ac.in') as any;
    const today = new Date().toISOString().split('T')[0];

    const req: any = {
      sqliteUser: wardenRecord,
      query: {
        date: today,
        year: 'ALL',
        block: 'ALL',
      },
    };
    const res = createMockRes();
    await reportHandler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.counts.totalStudents >= 1);
    assert.ok(res.body.counts.presentCount >= 1);

    // The student we registered and marked present must be in presentStudents
    const foundInPresent = res.body.presentStudents.find((s: any) => s.student_id === studentId);
    assert.ok(foundInPresent, 'Student must appear in presentStudents list');
    assert.equal(foundInPresent.status, 'Present');
  });

  test('8. Warden Manual Block Coordinate Management (POST /api/warden/block-coordinates)', async () => {
    const coordsHandler = getRouteHandler(wardenRoutes, '/block-coordinates', 'post');
    const wardenRecord = db.prepare('SELECT * FROM users WHERE email = ?').get('warden@gprec.ac.in') as any;

    const req: any = {
      sqliteUser: wardenRecord,
      body: {
        block_name: 'Anapurna-A',
        latitude: 15.8345,
        longitude: 78.0353,
        radius_meters: 175.0,
      },
    };
    const res = createMockRes();
    await coordsHandler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);

    // Verify persisted in SQLite
    const blockInDb = db.prepare('SELECT latitude, longitude, radius_meters FROM hostel_blocks WHERE block_name = ?').get('Anapurna-A') as { latitude: number; longitude: number; radius_meters: number };
    assert.equal(blockInDb.latitude, 15.8345);
    assert.equal(blockInDb.longitude, 78.0353);
    assert.equal(blockInDb.radius_meters, 175.0);
  });
});
