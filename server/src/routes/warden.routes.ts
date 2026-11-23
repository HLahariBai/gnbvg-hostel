import { Router, type Response } from 'express';
import { db } from '../db/sqlite.js';
import { authenticateSqlite, requireRole, type AuthenticatedSqliteRequest } from '../middleware/sqliteAuth.js';

const router = Router();

// Apply auth to all warden endpoints (allows 'warden' and 'admin')
router.use(authenticateSqlite);

// GET /api/warden/attendance-report?date=YYYY-MM-DD&year=ALL&block=ALL
// Queries users joined with attendance for that date, returning exact counts and full lists of:
// 1. Present Students with timestamps
// 2. Absent Students
// 3. Face-Not-Enrolled Students
router.get('/attendance-report', requireRole('warden', 'admin'), (req: AuthenticatedSqliteRequest, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const queryDate = typeof req.query.date === 'string' && req.query.date.match(/^\d{4}-\d{2}-\d{2}$/)
      ? req.query.date
      : today;

    const filterYear = typeof req.query.year === 'string' ? req.query.year : 'ALL';
    const filterBlock = typeof req.query.block === 'string' ? req.query.block : 'ALL';

    // Build parameterized query for all student users
    const whereConditions: string[] = ["role = 'student'"];
    const queryParams: any[] = [];

    if (filterYear !== 'ALL') {
      whereConditions.push('year = ?');
      queryParams.push(filterYear);
    }

    if (filterBlock !== 'ALL') {
      whereConditions.push('block = ?');
      queryParams.push(filterBlock);
    }

    const whereClause = whereConditions.join(' AND ');

    // 1. Fetch all student profiles matching the filter
    const studentsStmt = db.prepare(`
      SELECT id, name, roll_number, email, year, block, room_number, face_enrolled, created_at
      FROM users
      WHERE ${whereClause}
      ORDER BY block ASC, room_number ASC, roll_number ASC
    `);

    const students = studentsStmt.all(...queryParams) as Array<{
      id: string;
      name: string;
      roll_number: string;
      email: string;
      year: string;
      block: string;
      room_number: string;
      face_enrolled: number;
      created_at: string;
    }>;

    // 2. Fetch all attendance records for the given date
    const attendanceStmt = db.prepare(`
      SELECT id, student_id, roll_number, name, year, block, room_number, date, timestamp, latitude, longitude, status
      FROM attendance
      WHERE date = ?
    `);

    const attendanceRecords = attendanceStmt.all(queryDate) as Array<{
      id: string;
      student_id: string;
      roll_number: string;
      name: string;
      year: string;
      block: string;
      room_number: string;
      date: string;
      timestamp: string;
      latitude: number;
      longitude: number;
      status: string;
    }>;

    // Map attendance records by student_id
    const attendanceMap = new Map<string, typeof attendanceRecords[0]>();
    for (const record of attendanceRecords) {
      attendanceMap.set(record.student_id, record);
    }

    // 3. Categorize into 3 distinct cohorts
    const presentStudents: Array<any> = [];
    const absentStudents: Array<any> = [];
    const notEnrolledStudents: Array<any> = [];

    for (const student of students) {
      const attendance = attendanceMap.get(student.id);

      if (attendance) {
        // 1. Present Student
        presentStudents.push({
          student_id: student.id,
          roll_number: student.roll_number,
          name: student.name,
          email: student.email,
          year: student.year,
          block: student.block,
          room_number: student.room_number,
          date: attendance.date,
          timestamp: attendance.timestamp,
          latitude: attendance.latitude,
          longitude: attendance.longitude,
          status: 'Present',
        });
      } else if (student.face_enrolled === 1) {
        // 2. Absent Student (Face is enrolled, but did not mark attendance today)
        absentStudents.push({
          student_id: student.id,
          roll_number: student.roll_number,
          name: student.name,
          email: student.email,
          year: student.year,
          block: student.block,
          room_number: student.room_number,
          face_enrolled: true,
          status: 'Absent',
        });
      } else {
        // 3. Face-Not-Enrolled Student (Biometrics pending enrollment)
        notEnrolledStudents.push({
          student_id: student.id,
          roll_number: student.roll_number,
          name: student.name,
          email: student.email,
          year: student.year,
          block: student.block,
          room_number: student.room_number,
          face_enrolled: false,
          status: 'Biometrics Pending',
        });
      }
    }

    const totalStudents = students.length;
    const presentCount = presentStudents.length;
    const absentCount = absentStudents.length;
    const notEnrolledCount = notEnrolledStudents.length;
    const attendancePercentage = totalStudents > 0
      ? Number(((presentCount / totalStudents) * 100).toFixed(1))
      : 0;

    res.status(200).json({
      success: true,
      date: queryDate,
      filters: {
        year: filterYear,
        block: filterBlock,
      },
      counts: {
        totalStudents,
        presentCount,
        absentCount,
        notEnrolledCount,
        attendancePercentage,
      },
      presentStudents,
      absentStudents,
      notEnrolledStudents,
    });
  } catch (error) {
    console.error('[ATTENDANCE REPORT ERROR]:', error);
    res.status(500).json({
      success: false,
      error: 'An unexpected internal error occurred while generating attendance report.',
      details: error instanceof Error ? error.message : undefined,
    });
  }
});

// GET /api/warden/block-coordinates
// Returns list of all configured hostel blocks with their coordinates & radii
router.get('/block-coordinates', requireRole('warden', 'admin'), (_req: AuthenticatedSqliteRequest, res: Response) => {
  try {
    const blocksStmt = db.prepare('SELECT block_name, latitude, longitude, radius_meters FROM hostel_blocks ORDER BY block_name ASC');
    const blocks = blocksStmt.all();

    res.status(200).json({
      success: true,
      blocks,
    });
  } catch (error) {
    console.error('[GET BLOCK COORDS ERROR]:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve hostel block coordinates.',
      details: error instanceof Error ? error.message : undefined,
    });
  }
});

// POST /api/warden/block-coordinates
// Saves or updates manual geo-coordinates for each hostel block
router.post('/block-coordinates', requireRole('warden', 'admin'), (req: AuthenticatedSqliteRequest, res: Response) => {
  try {
    const { block_name, latitude, longitude, radius_meters } = req.body;

    if (!block_name || typeof block_name !== 'string') {
      res.status(400).json({ success: false, error: 'Valid block_name is required.' });
      return;
    }

    if (typeof latitude !== 'number' || typeof longitude !== 'number' || isNaN(latitude) || isNaN(longitude)) {
      res.status(400).json({ success: false, error: 'Valid numeric latitude and longitude coordinates are required.' });
      return;
    }

    const radius = typeof radius_meters === 'number' && radius_meters > 0 ? radius_meters : 150.0;

    const upsertStmt = db.prepare(`
      INSERT INTO hostel_blocks (block_name, latitude, longitude, radius_meters)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(block_name) DO UPDATE SET
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        radius_meters = excluded.radius_meters
    `);

    upsertStmt.run(block_name.trim(), latitude, longitude, radius);

    console.log(`[GEO-COORDINATES UPDATED] Block ${block_name}: lat ${latitude}, lon ${longitude}, radius ${radius}m`);

    // Fetch refreshed list
    const blocksStmt = db.prepare('SELECT block_name, latitude, longitude, radius_meters FROM hostel_blocks ORDER BY block_name ASC');
    const blocks = blocksStmt.all();

    res.status(200).json({
      success: true,
      message: `Geo-coordinates for block "${block_name}" updated successfully.`,
      updatedBlock: {
        block_name: block_name.trim(),
        latitude,
        longitude,
        radius_meters: radius,
      },
      blocks,
    });
  } catch (error) {
    console.error('[UPDATE BLOCK COORDS ERROR]:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update hostel block coordinates.',
      details: error instanceof Error ? error.message : undefined,
    });
  }
});

export default router;
