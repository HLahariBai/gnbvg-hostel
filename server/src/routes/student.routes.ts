import { Router, type Response } from 'express';
import crypto from 'node:crypto';
import { db } from '../db/sqlite.js';
import { authenticateSqlite, requireRole, type AuthenticatedSqliteRequest } from '../middleware/sqliteAuth.js';
import { calculateEuclideanDistance, calculateHaversineDistance } from '../utils/geoFace.js';

const router = Router();

// Apply auth to all student endpoints
router.use(authenticateSqlite);

// POST /api/student/enroll-face
// Saves the facial descriptor array to users.face_descriptor and sets face_enrolled = 1
router.post('/enroll-face', requireRole('student'), async (req: AuthenticatedSqliteRequest, res: Response) => {
  try {
    const student = req.sqliteUser!;
    const { face_descriptor } = req.body;

    if (!Array.isArray(face_descriptor) || face_descriptor.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Invalid face_descriptor: Must be a non-empty array of floating point numbers (e.g., 128 elements).',
      });
      return;
    }

    // Ensure all elements are numbers
    const areAllNumbers = face_descriptor.every((num) => typeof num === 'number' && !isNaN(num));
    if (!areAllNumbers) {
      res.status(400).json({
        success: false,
        error: 'All elements in face_descriptor must be valid numeric floating point values.',
      });
      return;
    }

    const descriptorJson = JSON.stringify(face_descriptor);

    const updateStmt = db.prepare(`
      UPDATE users
      SET face_descriptor = ?, face_enrolled = 1
      WHERE id = ?
    `);

    updateStmt.run(descriptorJson, student.id);

    console.log(`[FACE ENROLLMENT] Successfully enrolled 128-d face descriptor for student: ${student.roll_number} (${student.name})`);

    res.status(200).json({
      success: true,
      message: 'Facial biometrics enrolled successfully.',
      face_enrolled: true,
      descriptorLength: face_descriptor.length,
    });
  } catch (error) {
    console.error('[ENROLL FACE ERROR]:', error);
    res.status(500).json({
      success: false,
      error: 'An unexpected internal error occurred during biometric enrollment.',
      details: error instanceof Error ? error.message : undefined,
    });
  }
});

// POST /api/student/mark-attendance
// Verifies Euclidean distance between live face descriptor and stored face_descriptor,
// checks Haversine GPS distance against student's hostel block coordinates,
// and inserts a row into attendance table.
router.post('/mark-attendance', requireRole('student'), async (req: AuthenticatedSqliteRequest, res: Response) => {
  try {
    const student = req.sqliteUser!;
    const { face_descriptor, latitude, longitude } = req.body;

    // 1. Validate Face Biometric Payload
    if (!Array.isArray(face_descriptor) || face_descriptor.length === 0) {
      res.status(400).json({
        success: false,
        error: 'A live face descriptor array is required for attendance verification.',
      });
      return;
    }

    // 2. Validate Geolocation Payload
    if (typeof latitude !== 'number' || typeof longitude !== 'number' || isNaN(latitude) || isNaN(longitude)) {
      res.status(400).json({
        success: false,
        error: 'Valid GPS latitude and longitude coordinates are required.',
      });
      return;
    }

    // 3. Retrieve stored user biometric descriptor
    const userStmt = db.prepare('SELECT face_enrolled, face_descriptor, block, room_number, name, roll_number, year FROM users WHERE id = ?');
    const storedUser = userStmt.get(student.id) as {
      face_enrolled: number;
      face_descriptor: string | null;
      block: string | null;
      room_number: string | null;
      name: string;
      roll_number: string;
      year: string;
    } | undefined;

    if (!storedUser || !storedUser.face_enrolled || !storedUser.face_descriptor) {
      res.status(400).json({
        success: false,
        error: 'Facial biometrics not enrolled. Please complete face enrollment first before marking attendance.',
      });
      return;
    }

    let storedDescriptor: number[];
    try {
      storedDescriptor = JSON.parse(storedUser.face_descriptor);
    } catch {
      res.status(500).json({
        success: false,
        error: 'Corrupted biometric descriptor stored on server. Please re-enroll face.',
      });
      return;
    }

    // 4. Verify Euclidean Distance Match (threshold <= 0.6)
    let euclideanDistance: number;
    try {
      euclideanDistance = calculateEuclideanDistance(storedDescriptor, face_descriptor);
    } catch (err) {
      res.status(400).json({
        success: false,
        error: `Face biometric vector mismatch: ${err instanceof Error ? err.message : 'Invalid dimensions'}`,
      });
      return;
    }

    const MATCH_THRESHOLD = 0.60;
    if (euclideanDistance > MATCH_THRESHOLD) {
      console.warn(`[FACE REJECTED] Roll ${student.roll_number}: Euclidean distance ${euclideanDistance.toFixed(4)} > ${MATCH_THRESHOLD}`);
      res.status(403).json({
        success: false,
        error: `Facial verification failed: Distance ${euclideanDistance.toFixed(3)} exceeds match threshold of ${MATCH_THRESHOLD}. Please look directly into the camera in good lighting.`,
        euclideanDistance: Number(euclideanDistance.toFixed(4)),
        matchThreshold: MATCH_THRESHOLD,
      });
      return;
    }

    // 5. Check Hostel Block Geofence using Haversine Formula
    const studentBlock = storedUser.block || 'Anapurna-A';
    const blockStmt = db.prepare('SELECT latitude, longitude, radius_meters FROM hostel_blocks WHERE block_name = ?');
    let blockInfo = blockStmt.get(studentBlock) as { latitude: number; longitude: number; radius_meters: number } | undefined;

    // Fallback coordinates if block not yet in table
    if (!blockInfo) {
      blockInfo = { latitude: 15.8344, longitude: 78.0352, radius_meters: 150 };
    }

    const gpsDistanceMeters = calculateHaversineDistance(
      latitude,
      longitude,
      blockInfo.latitude,
      blockInfo.longitude
    );

    if (gpsDistanceMeters > blockInfo.radius_meters) {
      console.warn(`[GEOFENCE VIOLATION] Student ${student.roll_number} is ${gpsDistanceMeters.toFixed(1)}m away from ${studentBlock} (allowed: ${blockInfo.radius_meters}m)`);
      res.status(403).json({
        success: false,
        error: `Geofence violation: You are ${gpsDistanceMeters.toFixed(1)} meters away from your assigned hostel (${studentBlock}). You must be within ${blockInfo.radius_meters}m to mark attendance.`,
        currentDistanceMeters: Number(gpsDistanceMeters.toFixed(1)),
        allowedRadiusMeters: blockInfo.radius_meters,
      });
      return;
    }

    // 6. Check for duplicate attendance today
    const now = new Date();
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD

    const existingStmt = db.prepare('SELECT id, timestamp FROM attendance WHERE student_id = ? AND date = ?');
    const existingRecord = existingStmt.get(student.id, today) as { id: string; timestamp: string } | undefined;

    if (existingRecord) {
      res.status(409).json({
        success: false,
        error: `Attendance has already been recorded for today (${today}) at ${existingRecord.timestamp}.`,
        recordId: existingRecord.id,
      });
      return;
    }

    // 7. Insert Attendance Record
    const attendanceId = `att-${crypto.randomUUID()}`;
    const timestamp = now.toISOString();

    const insertStmt = db.prepare(`
      INSERT INTO attendance (
        id, student_id, roll_number, name, year, block, room_number,
        date, timestamp, latitude, longitude, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Present')
    `);

    insertStmt.run(
      attendanceId,
      student.id,
      storedUser.roll_number,
      storedUser.name,
      storedUser.year,
      studentBlock,
      storedUser.room_number || 'N/A',
      today,
      timestamp,
      latitude,
      longitude
    );

    console.log(`[ATTENDANCE MARKED] Student ${student.roll_number} verified (face diff: ${euclideanDistance.toFixed(3)}, distance: ${gpsDistanceMeters.toFixed(1)}m)`);

    res.status(201).json({
      success: true,
      message: 'Attendance verified and marked successfully as Present.',
      attendance: {
        id: attendanceId,
        student_id: student.id,
        roll_number: storedUser.roll_number,
        name: storedUser.name,
        year: storedUser.year,
        block: studentBlock,
        room_number: storedUser.room_number,
        date: today,
        timestamp,
        latitude,
        longitude,
        status: 'Present',
        metrics: {
          euclideanDistance: Number(euclideanDistance.toFixed(4)),
          gpsDistanceMeters: Number(gpsDistanceMeters.toFixed(1)),
        },
      },
    });
  } catch (error) {
    console.error('[MARK ATTENDANCE ERROR]:', error);
    res.status(500).json({
      success: false,
      error: 'An unexpected internal error occurred while recording attendance.',
      details: error instanceof Error ? error.message : undefined,
    });
  }
});

// GET /api/student/my-attendance
// Returns the logged-in student's profile, face_enrolled status, and all their attendance records
router.get('/my-attendance', requireRole('student'), async (req: AuthenticatedSqliteRequest, res: Response) => {
  try {
    const student = req.sqliteUser!;

    const recordsStmt = db.prepare(`
      SELECT id, date, timestamp, latitude, longitude, status, block, room_number
      FROM attendance
      WHERE student_id = ?
      ORDER BY date DESC, timestamp DESC
    `);

    const records = recordsStmt.all(student.id);

    res.status(200).json({
      success: true,
      student: {
        id: student.id,
        name: student.name,
        roll_number: student.roll_number,
        email: student.email,
        role: student.role,
        year: student.year,
        block: student.block,
        room_number: student.room_number,
        face_enrolled: Boolean(student.face_enrolled),
        created_at: student.created_at,
      },
      totalPresent: records.length,
      records,
    });
  } catch (error) {
    console.error('[GET MY ATTENDANCE ERROR]:', error);
    res.status(500).json({
      success: false,
      error: 'An unexpected internal error occurred while retrieving attendance history.',
      details: error instanceof Error ? error.message : undefined,
    });
  }
});

export default router;
