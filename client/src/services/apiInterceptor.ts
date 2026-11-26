import { executeTursoQuery, isStaticDeployment } from './tursoBridge';

export function initApiInterceptor() {
  if (typeof window === 'undefined') return;

  const originalFetch = window.fetch;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    // Only intercept /api/ requests on static deployment or if requested
    const isApiRequest = urlStr.startsWith('/api/') || urlStr.includes('/api/');
    if (!isApiRequest) {
      return originalFetch(input, init);
    }

    if (!isStaticDeployment()) {
      try {
        const resp = await originalFetch(input, init);
        if (resp.status !== 404 && resp.status !== 503 && resp.status !== 502) {
          return resp;
        }
      } catch (e) {
        // Fall through to Turso direct bridge
      }
    }

    console.log('[TURSO DIRECT BRIDGE] Intercepting API call on static host:', urlStr);

    try {
      const parsedUrl = new URL(urlStr, window.location.origin);
      const pathname = parsedUrl.pathname;
      const method = (init?.method || 'GET').toUpperCase();
      const body = init?.body ? JSON.parse(init.body as string) : {};

      // 1. GET /api/settings
      if (pathname === '/api/settings') {
        const rows = await executeTursoQuery('SELECT key, value FROM hostel_settings');
        const settings: Record<string, string> = {};
        rows.forEach((r) => {
          if (r.key) settings[r.key] = r.value;
        });
        return jsonResponse({
          success: true,
          settings,
          center: {
            lat: parseFloat(settings.geo_center_lat || '15.7743'),
            lng: parseFloat(settings.geo_center_lng || '78.0547'),
            radius_meters: parseFloat(settings.geo_radius_meters || '100.0'),
          },
          windowStatus: computeBridgeWindowStatus(settings),
        });
      }

      // 1b. POST /api/warden/settings
      if (pathname === '/api/warden/settings' && method === 'POST') {
        const allowedKeys = [
          'frs_start_time',
          'frs_end_time',
          'frs_window_override',
          'geo_radius_meters',
          'geo_q1_lat',
          'geo_q1_lng',
          'geo_q2_lat',
          'geo_q2_lng',
          'geo_q3_lat',
          'geo_q3_lng',
          'geo_q4_lat',
          'geo_q4_lng',
          'geo_center_lat',
          'geo_center_lng',
        ];
        for (const k of allowedKeys) {
          if (body[k] !== undefined && body[k] !== null && body[k] !== '') {
            await executeTursoQuery(
              'INSERT OR REPLACE INTO hostel_settings (key, value) VALUES (?, ?)',
              [k, String(body[k])]
            );
          }
        }
        const rows = await executeTursoQuery('SELECT key, value FROM hostel_settings');
        const settings: Record<string, string> = {};
        rows.forEach((r) => {
          if (r.key) settings[r.key] = r.value;
        });
        return jsonResponse({
          success: true,
          message: 'FRS timings and GPS geofence updated in Turso Cloud.',
          windowStatus: computeBridgeWindowStatus(settings),
        });
      }

      // 1c. GET /api/auth/verify-student
      if (pathname === '/api/auth/verify-student') {
        const roll = (parsedUrl.searchParams.get('roll_number') || '').trim().toUpperCase();
        if (!roll) {
          return jsonResponse({ success: false, error: 'Roll number is required.' }, 400);
        }
        const rows = await executeTursoQuery(
          'SELECT * FROM users WHERE UPPER(roll_number) = ? OR LOWER(email) = LOWER(?) LIMIT 1',
          [roll, roll]
        );
        if (rows.length === 0) {
          return jsonResponse({ success: false, eligible: false, error: 'Roll number not found in roster.' }, 404);
        }
        const st = rows[0];
        const isEnrolled = Number(st.face_enrolled) === 1 || Boolean(st.face_photo) || Boolean(st.face_descriptor);
        return jsonResponse({
          success: true,
          eligible: true,
          alreadyRegistered: Number(st.is_activated) === 1,
          student: {
            roll_number: st.roll_number,
            name: st.name,
            email: st.email,
            year: st.year,
            block: st.block,
            room_number: st.room_number,
            branch: st.branch,
            is_activated: Number(st.is_activated) === 1,
            face_enrolled: isEnrolled,
          },
        });
      }

      // 1d. POST /api/auth/send-registration-otp
      if (pathname === '/api/auth/send-registration-otp' && method === 'POST') {
        const qRoll = String(body.roll_number || '').trim().toUpperCase();
        const qEmail = String(body.email || '').trim().toLowerCase();
        const rows = await executeTursoQuery(
          'SELECT * FROM users WHERE UPPER(roll_number) = ? OR LOWER(email) = LOWER(?) LIMIT 1',
          [qRoll || qEmail, qEmail || qRoll]
        );
        if (rows.length === 0) {
          return jsonResponse({ success: false, error: 'Roll number not found in approved hostel admission roster.' }, 404);
        }
        const st = rows[0];
        if (Number(st.is_activated) === 1) {
          return jsonResponse({ success: false, error: `Account for ${st.roll_number} is already activated. Please sign in.` }, 409);
        }
        const targetEmail = (qEmail && qEmail.includes('@')) ? qEmail : (st.email || `${st.roll_number.toLowerCase()}@gprec.ac.in`);
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        return jsonResponse({
          success: true,
          message: `[Verification Code] Enter 6-digit code: ${otpCode}`,
          email: targetEmail,
          studentName: st.name,
          rollNumber: st.roll_number,
          block: st.block,
          roomNumber: st.room_number,
          year: st.year,
          devOtp: otpCode,
        });
      }

      // 1e. POST /api/auth/register
      if (pathname === '/api/auth/register' && method === 'POST') {
        const name = String(body.name || '').trim();
        const roll = String(body.roll_number || '').trim().toUpperCase();
        const email = String(body.email || '').trim().toLowerCase();
        const year = String(body.year || '1');
        const block = String(body.block || 'Anapurna-A');
        const room = String(body.room_number || 'A-101').trim().toUpperCase();
        if (!name || !email || !body.password) {
          return jsonResponse({ success: false, error: 'Name, email, and password are required.' }, 400);
        }
        if (!email.endsWith('@gprec.ac.in')) {
          return jsonResponse({ success: false, error: 'Official college email must end with @gprec.ac.in' }, 400);
        }
        const existingRows = await executeTursoQuery(
          'SELECT * FROM users WHERE UPPER(roll_number) = ? OR LOWER(email) = LOWER(?) LIMIT 1',
          [roll || email, email]
        );
        let user: any;
        if (existingRows.length > 0) {
          const existing = existingRows[0];
          if (Number(existing.is_activated) === 1) {
            return jsonResponse({ success: false, error: `Account for ${existing.roll_number} is already registered. Please log in.` }, 409);
          }
          await executeTursoQuery(
            'UPDATE users SET name = ?, email = ?, is_activated = 1 WHERE id = ?',
            [name, email, existing.id]
          );
          user = { ...existing, name, email, is_activated: 1 };
        } else {
          const newId = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          await executeTursoQuery(
            "INSERT INTO users (id, name, roll_number, email, password_hash, role, year, block, room_number, is_activated, face_enrolled, streak, dinner_rsvp) VALUES (?, ?, ?, ?, 'Student@123', 'student', ?, ?, ?, 1, 0, 0, 1)",
            [newId, name, roll || newId, email, year, block, room]
          );
          user = {
            id: newId,
            name,
            roll_number: roll || newId,
            email,
            role: 'student',
            year,
            block,
            room_number: room,
            face_enrolled: 0,
          };
        }
        return jsonResponse({
          success: true,
          message: 'Account registered successfully.',
          user: {
            id: user.id,
            name: user.name,
            roll_number: user.roll_number,
            email: user.email,
            role: 'student',
            year: user.year,
            block: user.block,
            room_number: user.room_number,
            face_enrolled: Number(user.face_enrolled) === 1,
          },
        }, 201);
      }

      // 2. POST /api/auth/login
      if (pathname === '/api/auth/login' && method === 'POST') {
        const query = (body.email || body.roll_number || '').trim();
        const rows = await executeTursoQuery(
          'SELECT * FROM users WHERE LOWER(email) = LOWER(?) OR UPPER(roll_number) = UPPER(?)',
          [query, query]
        );
        if (rows.length === 0) {
          return jsonResponse({ success: false, error: 'Student record not found in approved hostel roster.' }, 404);
        }
        const student = rows[0];
        const isEnrolled = Number(student.face_enrolled) === 1 || Boolean(student.face_photo) || Boolean(student.face_descriptor);
        return jsonResponse({
          success: true,
          user: {
            id: student.roll_number || student.id,
            roll_number: student.roll_number,
            name: student.name,
            email: student.email,
            year: student.year,
            block: student.block,
            room: student.room_number,
            room_number: student.room_number,
            face_enrolled: isEnrolled ? 1 : 0,
            faceEnrolled: isEnrolled,
            face_photo: student.face_photo || null,
            facePhoto: student.face_photo || null,
            face_enrolled_at: student.face_enrolled_at || null,
            streak: Number(student.streak || 1),
            dinnerRsvp: student.dinner_rsvp === undefined || student.dinner_rsvp === null ? true : Number(student.dinner_rsvp) === 1,
          },
        });
      }

      // 3. POST /api/warden/login
      if (pathname === '/api/warden/login' && method === 'POST') {
        const pass = String(body.password || '').trim();
        if (pass === 'Warden@123' || pass === 'Admin@123') {
          return jsonResponse({ success: true, token: 'static-warden-session-token' });
        }
        return jsonResponse({ success: false, error: 'Invalid warden credentials. Use default Warden@123.' }, 401);
      }

      // 4. GET /api/student/my-attendance
      if (pathname === '/api/student/my-attendance') {
        const roll = (parsedUrl.searchParams.get('roll_number') || parsedUrl.searchParams.get('student_id') || '').trim();
        const todayStr = new Date().toISOString().split('T')[0];
        const records = await executeTursoQuery(
          'SELECT * FROM attendance WHERE UPPER(roll_number) = UPPER(?) OR student_id = ? ORDER BY date DESC, timestamp DESC LIMIT 90',
          [roll, roll]
        );
        const todayRecord = records.find((r) => r.date === todayStr);
        const leaves = await executeTursoQuery(
          "SELECT * FROM outpasses WHERE (UPPER(roll_number) = UPPER(?) OR student_id = ?) AND status = 'Approved' AND from_date <= ? AND to_date >= ?",
          [roll, roll, todayStr, todayStr]
        );
        const activeLeave = leaves[0] || null;

        return jsonResponse({
          success: true,
          todayDate: todayStr,
          todayStatus: todayRecord ? todayRecord.status : activeLeave ? 'On Approved Leave' : 'Pending Check-In',
          todayRecord: todayRecord || null,
          activeLeave,
          records,
        });
      }

      // 5. POST /api/students/enroll-face || /api/student/enroll-face
      if ((pathname === '/api/students/enroll-face' || pathname === '/api/student/enroll-face') && method === 'POST') {
        const { roll_number, student_id, face_descriptor, face_photo, attempts_used, client_enrolled_at } = body;
        const targetRoll = String(roll_number || student_id || '').trim().toUpperCase();
        const targetId = String(student_id || roll_number || '').trim();
        const enrolledAt = (typeof client_enrolled_at === 'string' && client_enrolled_at.trim())
          ? client_enrolled_at.trim()
          : formatBridgeISTDateTime();
        const attempts = Math.min(Math.max(Number(attempts_used) || 1, 1), 3);
        const descriptorJson = JSON.stringify(face_descriptor);
        await executeTursoQuery(
          'UPDATE users SET face_descriptor = ?, face_photo = ?, face_enrolled = 1, face_enrolled_at = ?, face_enroll_attempts = ? WHERE UPPER(roll_number) = ? OR id = ?',
          [descriptorJson, face_photo, enrolledAt, attempts, targetRoll, targetId]
        );
        return jsonResponse({
          success: true,
          message: 'Biometric face profile and Smart ID photo saved to Turso Cloud! Smart ID Card and FRS enrolled.',
          face_enrolled_at: enrolledAt,
          attemptsUsed: attempts,
          remainingAttempts: Math.max(0, 3 - attempts),
        });
      }

      // 6. POST /api/attendance/mark
      if ((pathname === '/api/attendance/mark' || pathname === '/api/student/mark-attendance') && method === 'POST') {
        const { roll_number, latitude, longitude, client_timestamp } = body;
        const targetRoll = (roll_number || '').trim().toUpperCase();
        const now = new Date();
        const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        const freshISTTime = now.toLocaleTimeString('en-US', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        });
        const nowTime = (typeof client_timestamp === 'string' && client_timestamp.trim())
          ? client_timestamp.trim()
          : freshISTTime;

        const userRows = await executeTursoQuery('SELECT * FROM users WHERE UPPER(roll_number) = ?', [targetRoll]);
        const student = userRows[0];
        if (!student) {
          return jsonResponse({ success: false, error: 'Student not found.' }, 404);
        }

        const centerLat = 15.7743;
        const centerLng = 78.0547;
        const allowedRadius = 100.0;
        let gpsDistance = 0;
        if (typeof latitude === 'number' && typeof longitude === 'number' && !isNaN(latitude) && !isNaN(longitude)) {
          const dLat = ((centerLat - latitude) * Math.PI) / 180;
          const dLon = ((centerLng - longitude) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((latitude * Math.PI) / 180) *
            Math.cos((centerLat * Math.PI) / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          gpsDistance = Math.round(6371000 * c);
        } else {
          return jsonResponse({
            success: false,
            error: 'GPS location coordinates are required. FRS attendance cannot be recorded without GPS verification.',
          }, 400);
        }

        if (gpsDistance > allowedRadius) {
          return jsonResponse({
            success: false,
            isGeofenceBreach: true,
            gpsDistance,
            allowedRadius,
            error: `Geofence Violation: You are ${gpsDistance}m away from GNBVG Hostel. FRS attendance rejected. Please go to the given coordinate area (15.7743° N, 78.0547° E) to scan your face.`,
            targetCoordinates: { lat: centerLat, lng: centerLng },
          }, 403);
        }

        const existingRows = await executeTursoQuery(
          'SELECT * FROM attendance WHERE UPPER(roll_number) = ? AND date = ?',
          [targetRoll, todayStr]
        );

        if (existingRows.length > 0) {
          return jsonResponse({
            success: true,
            alreadyMarked: true,
            isDuplicate: true,
            status: 'Present',
            message: `Attendance already verified for today at ${existingRows[0].timestamp}. Duplicate check-in absorbed (Strict 1 record per student per day).`,
            date: todayStr,
            timestamp: existingRows[0].timestamp,
          });
        }

        const attId = `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        await executeTursoQuery(
          'INSERT INTO attendance (id, student_id, roll_number, name, year, block, room_number, date, timestamp, latitude, longitude, face_distance, gps_distance, status, is_geofence_breach) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [attId, student.id, student.roll_number, student.name, student.year, student.block, student.room_number, todayStr, nowTime, latitude || 15.7743, longitude || 78.0547, 0.04, 12, 'Present', 0]
        );

        return jsonResponse({
          success: true,
          status: 'Attendance Submitted',
          message: 'Attendance check-in submitted successfully to Turso Cloud.',
          date: todayStr,
          timestamp: nowTime,
        });
      }

      // 7. GET /api/warden/dashboard
      if (pathname === '/api/warden/dashboard') {
        const istToday = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        const queryDate = parsedUrl.searchParams.get('date') || istToday;
        const allStudentsRaw = await executeTursoQuery(
          "SELECT id, roll_number, name, email, role, year, block, room_number, face_enrolled, face_photo, face_enrolled_at, face_enroll_attempts, streak, dinner_rsvp, student_phone, father_phone, (face_descriptor IS NOT NULL AND face_descriptor != '') AS has_descriptor FROM users WHERE role = 'student'"
        );
        const allStudents = allStudentsRaw.map((s) => {
          const isEnrolled = Number(s.face_enrolled) === 1 || Boolean(s.face_photo) || Number(s.has_descriptor) === 1;
          return {
            id: s.roll_number || s.id,
            roll_number: s.roll_number || s.id,
            name: s.name,
            email: s.email,
            year: formatBridgeYearLabel(s.year),
            block: s.block || 'Anapurna-A',
            room: s.room_number || 'A-101',
            room_number: s.room_number || 'A-101',
            face_enrolled: isEnrolled ? 1 : 0,
            faceEnrolled: isEnrolled,
            face_photo: s.face_photo || null,
            facePhoto: s.face_photo || null,
            face_enrolled_at: s.face_enrolled_at || null,
            face_enroll_attempts: Number(s.face_enroll_attempts || 0),
            profileStatus: isEnrolled ? 'FRS Enrolled' : 'Enrollment Pending',
            streak: isEnrolled ? Number(s.streak || 0) : 0,
            dinnerRsvp: s.dinner_rsvp === undefined || s.dinner_rsvp === null ? true : Number(s.dinner_rsvp) === 1,
            father_phone: s.father_phone,
            student_phone: s.student_phone,
          };
        });
        const attendanceRows = await executeTursoQuery('SELECT * FROM attendance WHERE date = ?', [queryDate]);
        const approvedLeaves = await executeTursoQuery(
          "SELECT * FROM outpasses WHERE status = 'Approved' AND from_date <= ? AND to_date >= ?",
          [queryDate, queryDate]
        );
        const allOutpasses = await executeTursoQuery('SELECT * FROM outpasses ORDER BY created_at DESC LIMIT 50');
        const allTickets = await executeTursoQuery('SELECT * FROM maintenance_tickets ORDER BY created_at DESC LIMIT 50');

        const presentStudents = attendanceRows.map((a) => ({
          id: a.id,
          studentId: a.roll_number,
          roll_number: a.roll_number,
          name: a.name,
          year: formatBridgeYearLabel(a.year),
          block: a.block,
          room: a.room_number,
          timestamp: a.timestamp,
          method: 'FRS Biometrics + GPS',
          status: a.status,
        }));

        const leaveStudents = approvedLeaves.map((l) => ({
          id: l.id,
          studentId: l.roll_number,
          roll_number: l.roll_number,
          name: l.student_name,
          year: formatBridgeYearLabel(l.year),
          block: l.block,
          leaveType: l.type,
          fromDate: l.from_date,
          toDate: l.to_date,
        }));

        const presentRolls = new Set(attendanceRows.map((a) => a.roll_number));
        const leaveRolls = new Set(approvedLeaves.map((l) => l.roll_number));
        const absentStudents = allStudents.filter((s) => !presentRolls.has(s.roll_number) && !leaveRolls.has(s.roll_number));
        const enrolledFaceCount = allStudents.filter((s) => s.faceEnrolled).length;

        return jsonResponse({
          success: true,
          syncedAt: formatBridgeISTDateTime(),
          allStudents,
          presentStudents,
          absentStudents,
          leaveStudents,
          outpasses: allOutpasses,
          tickets: allTickets,
          outOfRangeAlerts: attendanceRows.filter((a) => Number(a.is_geofence_breach) === 1),
          kpis: {
            totalStudents: allStudents.length,
            presentCount: presentStudents.length,
            absentCount: absentStudents.length,
            leaveCount: leaveStudents.length,
            enrolledFaceCount,
            pendingFaceCount: allStudents.length - enrolledFaceCount,
          },
          stats: {
            total: allStudents.length,
            present: presentStudents.length,
            absent: absentStudents.length,
            leaves: leaveStudents.length,
            enrolledFaceCount,
            percent: Math.round((presentStudents.length / (allStudents.length || 1)) * 100),
          },
        });
      }

      // 8. POST /api/outpass/apply
      if (pathname === '/api/outpass/apply' && method === 'POST') {
        const id = `op-${Date.now()}`;
        await executeTursoQuery(
          'INSERT INTO outpasses (id, student_id, roll_number, student_name, year, block, room_number, type, from_date, to_date, reason, parent_phone, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [id, body.student_id, body.roll_number, body.name, body.year, body.block, body.room_number, body.type, body.from_date, body.to_date, body.reason, body.parent_phone, 'Approved']
        );
        return jsonResponse({ success: true, message: 'Outpass submitted and approved!' });
      }

      // 9. POST /api/tickets/create
      if (pathname === '/api/tickets/create' && method === 'POST') {
        const id = `tkt-${Date.now()}`;
        await executeTursoQuery(
          'INSERT INTO maintenance_tickets (id, student_id, roll_number, student_name, block, room_number, category, description, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [id, body.student_id, body.roll_number, body.name, body.block, body.room_number, body.category, body.description, 'Open']
        );
        return jsonResponse({ success: true, message: 'Helpdesk ticket raised successfully!' });
      }

      // 9b. POST /api/student/dinner-rsvp
      if (pathname === '/api/student/dinner-rsvp' && method === 'POST') {
        const roll = String(body.roll_number || '').trim();
        const sId = String(body.student_id || '').trim();
        const val = body.dinner_rsvp ? 1 : 0;
        await executeTursoQuery(
          'UPDATE users SET dinner_rsvp = ? WHERE UPPER(roll_number) = UPPER(?) OR id = ?',
          [val, roll, sId]
        );
        return jsonResponse({
          success: true,
          message: `Dinner RSVP updated: ${val ? 'Dining in mess' : 'Skipping dinner'}.`,
          dinner_rsvp: val === 1,
        });
      }

      // 10. POST /api/warden/students/reset-face
      if (pathname === '/api/warden/students/reset-face' && method === 'POST') {
        const roll = String(body.roll_number || body.student_id || '').trim().toUpperCase();
        const sId = String(body.student_id || body.roll_number || '').trim();
        await executeTursoQuery(
          'UPDATE users SET face_descriptor = NULL, face_photo = NULL, face_enrolled = 0, face_enrolled_at = NULL, face_enroll_attempts = 0 WHERE UPPER(roll_number) = ? OR id = ?',
          [roll, sId]
        );
        return jsonResponse({ success: true, message: `Face ID reset for ${roll}.` });
      }

      // 11. POST /api/warden/attendance/purge-history
      if (pathname === '/api/warden/attendance/purge-history' && method === 'POST') {
        await executeTursoQuery('DELETE FROM attendance');
        return jsonResponse({ success: true, message: 'All past attendance logs cleared from Turso Cloud.' });
      }

      // Fallback
      return jsonResponse({ success: true, message: 'OK' });
    } catch (err: any) {
      console.error('[TURSO BRIDGE ERROR]', err);
      return jsonResponse({ success: false, error: err.message }, 500);
    }
  };
}

function formatBridgeISTDateTime(now: Date = new Date()): string {
  const formatted = now.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
  return `${formatted} IST`;
}

function formatBridgeYearLabel(rawYear: unknown): string {
  const y = String(rawYear || '').trim();
  if (!y) return '1st Year';
  if (y === '1' || y.startsWith('1')) return '1st Year';
  if (y === '2' || y.startsWith('2')) return '2nd Year';
  if (y === '3' || y.startsWith('3')) return '3rd Year';
  if (y === '4' || y.startsWith('4')) return '4th Year';
  if (y.toLowerCase().includes('alumni')) return 'Alumni Year';
  return y;
}

function computeBridgeWindowStatus(settings: Record<string, string>) {
  const startTime = settings.frs_start_time || '17:00';
  const endTime = settings.frs_end_time || '19:00';
  const override = settings.frs_window_override || 'auto';
  if (override === 'open') return { isOpen: true, status: 'OPEN', override: true, startTime, endTime };
  if (override === 'closed') return { isOpen: false, status: 'CLOSED', override: true, startTime, endTime };

  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(now);
  const h = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10) % 24;
  const m = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
  const startParts = startTime.split(':').map(Number);
  const endParts = endTime.split(':').map(Number);
  const curMin = h * 60 + m;
  const isOpen = curMin >= (startParts[0] || 17) * 60 + (startParts[1] || 0) && curMin <= (endParts[0] || 19) * 60 + (endParts[1] || 0);
  return { isOpen, status: isOpen ? 'OPEN' : 'CLOSED', override: false, startTime, endTime };
}

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
