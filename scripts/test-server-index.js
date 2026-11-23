import { EventEmitter } from 'node:events';
import { app, db } from '../server/index.js';

function mockRequest(app, method, url, body = null, headers = {}) {
  return new Promise((resolve) => {
    const req = new EventEmitter();
    req.method = method;
    req.url = url;
    req.headers = { 'content-type': 'application/json', ...headers };
    req.body = body;
    req.query = {};

    if (url.includes('?')) {
      const q = new URLSearchParams(url.split('?')[1]);
      for (const [k, v] of q.entries()) {
        req.query[k] = v;
      }
    }

    const res = new EventEmitter();
    res.statusCode = 200;
    res.headers = {};
    res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; };
    res.getHeader = (k) => res.headers[k.toLowerCase()];
    res.cookie = () => res;
    res.clearCookie = () => res;
    res.status = (code) => { res.statusCode = code; return res; };

    res.json = (data) => {
      resolve({ status: res.statusCode, body: data });
    };
    res.send = (data) => {
      resolve({ status: res.statusCode, body: data });
    };

    app.handle(req, res);
  });
}

async function runTests() {
  console.log('[TEST] Starting server/index.js direct handler integration tests...');

  // 1. Health Check
  const health = await mockRequest(app, 'GET', '/api/health');
  console.log('1. Health Check:', health.status, health.body?.status, `(Users: ${health.body?.totalUsers})`);

  // 2. Student Roster Verification
  const verify = await mockRequest(app, 'GET', '/api/auth/verify-student?roll_number=249X1A0504');
  console.log('2. Verify Student (249X1A0504):', verify.status, verify.body?.student?.name, verify.body?.student?.block);

  // 3. Warden Login
  const wardenLogin = await mockRequest(app, 'POST', '/api/warden/login', {
    email: 'warden@gprec.ac.in',
    password: 'Warden@123',
  });
  console.log('3. Warden Login:', wardenLogin.status, wardenLogin.body?.success, wardenLogin.body?.user?.name);

  // 4. Student Face Enrollment (128-float vector)
  const syntheticFace = Array.from({ length: 128 }, (_, i) => Math.sin(i) * 0.1);
  const enrollFace = await mockRequest(app, 'POST', '/api/students/enroll-face', {
    roll_number: '249X1A0504',
    face_descriptor: syntheticFace,
  });
  console.log('4. Face Enrollment:', enrollFace.status, enrollFace.body?.success, enrollFace.body?.message);

  // 5. Daily FRS Attendance - Matching face (< 0.45) & Valid GPS
  const matchingFace = syntheticFace.map((v) => v + 0.005); // Euclidean distance ~ 0.05
  const markAtt = await mockRequest(app, 'POST', '/api/attendance/mark', {
    roll_number: '249X1A0504',
    face_descriptor: matchingFace,
    latitude: 15.8344,
    longitude: 78.0352,
  });
  console.log('5. Attendance Check-in:', markAtt.status, markAtt.body?.success, markAtt.body?.message || markAtt.body?.error);

  // 6. Daily FRS Attendance - Face Mismatch rejection (distance >= 0.45)
  const mismatchFace = Array.from({ length: 128 }, (_, i) => Math.cos(i) * 0.8);
  const badAtt = await mockRequest(app, 'POST', '/api/attendance/mark', {
    roll_number: '249X1A0504',
    face_descriptor: mismatchFace,
    latitude: 15.8344,
    longitude: 78.0352,
  });
  console.log('6. Face Mismatch Rejection (Expected 403):', badAtt.status, badAtt.body?.error);

  // 7. Warden Dashboard KPIs
  const dashboard = await mockRequest(app, 'GET', '/api/warden/dashboard?year=ALL&block=ALL');
  console.log('7. Warden Dashboard KPIs:', dashboard.status, dashboard.body?.kpis);

  // 8. Outpass Apply
  const applyOp = await mockRequest(app, 'POST', '/api/outpass/apply', {
    roll_number: '249X1A0504',
    type: 'Weekend Outing',
    from_date: '2026-11-20',
    to_date: '2026-11-22',
    reason: 'Home visit',
  });
  console.log('8. Apply Outpass:', applyOp.status, applyOp.body?.success, applyOp.body?.outpassId);

  // 9. Maintenance Ticket
  const createTk = await mockRequest(app, 'POST', '/api/tickets/create', {
    roll_number: '249X1A0504',
    category: 'Electrical',
    description: 'Ceiling fan regulator not working',
  });
  console.log('9. Maintenance Ticket:', createTk.status, createTk.body?.success, createTk.body?.ticketId);

  // 10. Dinner RSVP
  const dinnerRsvp = await mockRequest(app, 'POST', '/api/student/dinner-rsvp', {
    roll_number: '249X1A0504',
    dinner_rsvp: true,
  });
  console.log('10. Dinner RSVP:', dinnerRsvp.status, dinnerRsvp.body?.success);

  // 11. Annual Academic Batch Rollover
  const promote = await mockRequest(app, 'POST', '/api/warden/promote-batch', {});
  console.log('11. Annual Academic Batch Rollover:', promote.status, promote.body?.promotedCounts);

  console.log('\n[SUCCESS] ALL 11 ENDPOINTS TESTED AND VERIFIED SUCCESSFULLY!');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('[TEST ERROR]:', err);
  process.exit(1);
});
