import { AttendanceStatus, VerificationMethod, StudentStatus } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { calculateHaversineDistance, hostelService } from '../hostel/hostel.service.js';
import { recordAuditLog } from '../../utils/audit.js';
import { realtimeEmitter } from '../../realtime/events.js';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../../errors/AppError.js';
import { ATTENDANCE_CONSTRAINTS } from '../../constants/index.js';

export function getKolkataDateString(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function getKolkataTimeString(d = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

export class AttendanceService {
  /**
   * Primary daily attendance submission.
   * Performs complete authoritative server-side validation:
   * 1. Active student status check
   * 2. Operating attendance window check in Asia/Kolkata timezone
   * 3. Geofence distance & GPS accuracy check
   * 4. Liveness & face match confidence threshold check
   * 5. Server-derived date duplicate prevention
   * 6. Transactional persistence & immediate real-time event broadcast
   */
  async recordAttendance(
    studentId: string,
    dto: {
      latitude: number;
      longitude: number;
      accuracyMeters: number;
      captureTimestamp: string;
      faceConfidence: number;
      livenessConfidence: number;
      photoMetadata?: any;
    },
    clientIp?: string,
    userAgent?: string
  ) {
    // 1. Fetch Student Profile with Block & Room
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        block: true,
        room: true,
      },
    });

    if (!student) {
      throw new NotFoundError('Student profile not found.');
    }

    if (student.status !== StudentStatus.ACTIVE) {
      throw new ForbiddenError(`Attendance blocked: Student account status is ${student.status}.`);
    }

    // 2. Fetch Hostel Master Configuration (Geofence & Timings)
    const hostel = await hostelService.getOrCreateHostelConfig();

    // 3. Derive Today's Date in Asia/Kolkata Timezone
    const now = new Date();
    const dateStr = getKolkataDateString(now);
    const currentDateMidnight = new Date(`${dateStr}T00:00:00.000Z`);
    const currentTimeStr = getKolkataTimeString(now);

    // 4. Validate Attendance Window
    const isWithinWindow =
      currentTimeStr >= hostel.attendanceStart && currentTimeStr <= hostel.attendanceEnd;

    if (!isWithinWindow) {
      await prisma.attendanceAttempt.create({
        data: {
          studentId: student.id,
          latitude: dto.latitude,
          longitude: dto.longitude,
          accuracyMeters: dto.accuracyMeters,
          stageFailed: 'WINDOW_CLOSED',
          failureReason: `Attendance window is closed. Daily operating hours: ${hostel.attendanceStart} to ${hostel.attendanceEnd} IST. Current: ${currentTimeStr} IST.`,
        },
      });

      throw new BadRequestError(
        `Attendance window is currently closed. Operating hours are ${hostel.attendanceStart} to ${hostel.attendanceEnd} IST.`
      );
    }

    // 5. Check Duplicate Attendance for Current Date
    const existingAttendance = await prisma.attendance.findUnique({
      where: {
        studentId_date: {
          studentId: student.id,
          date: currentDateMidnight,
        },
      },
    });

    if (existingAttendance) {
      await prisma.attendanceAttempt.create({
        data: {
          studentId: student.id,
          latitude: dto.latitude,
          longitude: dto.longitude,
          accuracyMeters: dto.accuracyMeters,
          insideGeofence: true,
          passedLiveness: true,
          passedFaceMatch: true,
          stageFailed: 'DUPLICATE',
          failureReason: `Duplicate attempt: Student has already recorded attendance on ${dateStr} at ${existingAttendance.checkInTime.toISOString()}.`,
        },
      });

      return {
        status: AttendanceStatus.DUPLICATE,
        message: `Attendance has already been recorded for today (${dateStr}) at ${existingAttendance.checkInTime.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST.`,
        attendance: existingAttendance,
      };
    }

    // 6. Geofence Containment & GPS Accuracy Validation
    const distanceMeters = calculateHaversineDistance(
      hostel.centerLat,
      hostel.centerLng,
      dto.latitude,
      dto.longitude
    );

    const insideGeofence = distanceMeters <= hostel.geofenceRadiusMeters;
    const accuracyPassed = dto.accuracyMeters <= ATTENDANCE_CONSTRAINTS.MAX_GPS_ACCURACY_METERS;

    // Check GPS timestamp freshness (within 60 seconds)
    const captureTimestampMs = new Date(dto.captureTimestamp).getTime();
    const freshnessPassed = Math.abs(now.getTime() - captureTimestampMs) <= ATTENDANCE_CONSTRAINTS.MAX_GPS_AGE_SECONDS * 1000;

    if (!insideGeofence || !accuracyPassed || !freshnessPassed) {
      let stageFailed = 'GEO_LOCATION';
      let failureReason = `Student location (${distanceMeters}m) is outside hostel perimeter (${hostel.geofenceRadiusMeters}m).`;

      if (!accuracyPassed) {
        stageFailed = 'GPS_ACCURACY';
        failureReason = `GPS accuracy of ${dto.accuracyMeters}m exceeds maximum allowed threshold (${ATTENDANCE_CONSTRAINTS.MAX_GPS_ACCURACY_METERS}m).`;
      } else if (!freshnessPassed) {
        stageFailed = 'GEO_LOCATION';
        failureReason = `GPS sample timestamp is stale (> 60 seconds old).`;
      }

      await prisma.attendanceAttempt.create({
        data: {
          studentId: student.id,
          latitude: dto.latitude,
          longitude: dto.longitude,
          accuracyMeters: dto.accuracyMeters,
          insideGeofence,
          stageFailed,
          failureReason,
        },
      });

      throw new BadRequestError(`Geofence Verification Failed: ${failureReason}`);
    }

    // 7. Biometrics (Liveness & Face Match) Validation
    const livenessPassed = dto.livenessConfidence >= ATTENDANCE_CONSTRAINTS.LIVENESS_CONFIDENCE_THRESHOLD;
    const faceMatchPassed = dto.faceConfidence >= ATTENDANCE_CONSTRAINTS.FACE_CONFIDENCE_THRESHOLD;

    if (!livenessPassed || !faceMatchPassed) {
      const stageFailed = !livenessPassed ? 'LIVENESS' : 'FACE_MATCH';
      const failureReason = !livenessPassed
        ? `Liveness verification score (${dto.livenessConfidence}) is below confidence threshold (${ATTENDANCE_CONSTRAINTS.LIVENESS_CONFIDENCE_THRESHOLD}).`
        : `Face matching similarity (${dto.faceConfidence}) is below confidence threshold (${ATTENDANCE_CONSTRAINTS.FACE_CONFIDENCE_THRESHOLD}).`;

      await prisma.attendanceAttempt.create({
        data: {
          studentId: student.id,
          latitude: dto.latitude,
          longitude: dto.longitude,
          accuracyMeters: dto.accuracyMeters,
          insideGeofence: true,
          faceConfidence: dto.faceConfidence,
          livenessConfidence: dto.livenessConfidence,
          passedLiveness: livenessPassed,
          passedFaceMatch: faceMatchPassed,
          stageFailed,
          failureReason,
        },
      });

      throw new BadRequestError(`Biometric Verification Failed: ${failureReason}`);
    }

    // 8. Transactional Attendance Persistence
    const result = await prisma.$transaction(async (tx) => {
      // Create confirmed attendance record
      const attendance = await tx.attendance.create({
        data: {
          studentId: student.id,
          date: currentDateMidnight,
          checkInTime: now,
          latitude: dto.latitude,
          longitude: dto.longitude,
          accuracyMeters: dto.accuracyMeters,
          insideGeofence: true,
          faceConfidence: dto.faceConfidence,
          livenessConfidence: dto.livenessConfidence,
          status: AttendanceStatus.PRESENT,
          verificationMethod: VerificationMethod.FACE_GEO_APP,
          remarks: 'Verified via Mobile Face Recognition & Geofence App',
        },
      });

      // Log successful attempt
      await tx.attendanceAttempt.create({
        data: {
          studentId: student.id,
          latitude: dto.latitude,
          longitude: dto.longitude,
          accuracyMeters: dto.accuracyMeters,
          insideGeofence: true,
          faceConfidence: dto.faceConfidence,
          livenessConfidence: dto.livenessConfidence,
          passedLiveness: true,
          passedFaceMatch: true,
        },
      });

      return attendance;
    });

    // 9. Real-Time Broadcast (Emitted STRICTLY after DB transaction commits)
    realtimeEmitter.emitAttendanceRecorded({
      id: result.id,
      studentId: student.id,
      registrationNumber: student.registrationNumber,
      studentName: student.fullName,
      blockCode: student.block.code,
      roomNumber: student.room.roomNumber,
      status: result.status,
      date: dateStr,
      checkInTime: result.checkInTime.toISOString(),
      accuracyMeters: result.accuracyMeters,
    });

    await recordAuditLog({
      actorId: student.userId,
      actorRole: 'STUDENT',
      action: 'ATTENDANCE_RECORDED_PRESENT',
      entityName: 'Attendance',
      entityId: result.id,
      newState: {
        studentId: student.id,
        date: dateStr,
        status: result.status,
        distanceMeters,
      },
      ipAddress: clientIp,
      userAgent,
    });

    return {
      status: AttendanceStatus.PRESENT,
      message: 'Verified attendance successfully recorded.',
      attendance: result,
      details: {
        date: dateStr,
        distanceFromCenter: `${distanceMeters}m`,
        accuracy: `${dto.accuracyMeters}m`,
        block: student.block.name,
        room: student.room.roomNumber,
      },
    };
  }

  /**
   * Retrieves today's attendance status for a student.
   */
  async getTodayStatus(studentId: string) {
    const dateStr = getKolkataDateString();
    const currentDateMidnight = new Date(`${dateStr}T00:00:00.000Z`);

    const attendance = await prisma.attendance.findUnique({
      where: {
        studentId_date: {
          studentId,
          date: currentDateMidnight,
        },
      },
    });

    const hostel = await hostelService.getOrCreateHostelConfig();
    const currentTimeStr = getKolkataTimeString();
    const isWindowOpen = currentTimeStr >= hostel.attendanceStart && currentTimeStr <= hostel.attendanceEnd;

    return {
      date: dateStr,
      hasRecorded: Boolean(attendance),
      status: attendance ? attendance.status : (isWindowOpen ? 'NOT_GIVEN' : 'WINDOW_CLOSED'),
      attendance: attendance || null,
      window: {
        start: hostel.attendanceStart,
        end: hostel.attendanceEnd,
        isOpen: isWindowOpen,
      },
    };
  }

  /**
   * Retrieves historical attendance records for a student.
   */
  async getMyHistory(studentId: string, page = 1, limit = 30) {
    const skip = (page - 1) * limit;

    const [total, attendances] = await Promise.all([
      prisma.attendance.count({ where: { studentId } }),
      prisma.attendance.findMany({
        where: { studentId },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: attendances,
    };
  }

  /**
   * Generates live hostel-wide and block-wise attendance roll-up for the Warden / Admin Dashboard.
   */
  async getLiveSummary() {
    const dateStr = getKolkataDateString();
    const currentDateMidnight = new Date(`${dateStr}T00:00:00.000Z`);

    // 1. Total Active Residents
    const totalStudents = await prisma.student.count({
      where: { status: StudentStatus.ACTIVE },
    });

    // 2. Verified Present Today
    const presentToday = await prisma.attendance.count({
      where: {
        date: currentDateMidnight,
        status: AttendanceStatus.PRESENT,
      },
    });

    // 3. Pending Review Cases
    const pendingReviewToday = await prisma.attendance.count({
      where: {
        date: currentDateMidnight,
        status: AttendanceStatus.PENDING_REVIEW,
      },
    });

    // 4. Students On Approved Leave Today
    const now = new Date();
    const onLeaveToday = await prisma.leaveRequest.count({
      where: {
        status: 'APPROVED',
        fromDate: { lte: now },
        expectedReturnDate: { gte: now },
      },
    });

    // 5. Students Out On Gate Pass Today
    const outOnPassToday = await prisma.gatePass.count({
      where: {
        status: 'CHECKED_OUT',
      },
    });

    // 6. Block-Wise Breakdown: Block A (Arundhathi), Block B (Annapurna), Block C (Anuradha)
    const blocks = await prisma.block.findMany({
      orderBy: { code: 'asc' },
      include: {
        _count: {
          select: { students: true },
        },
      },
    });

    const blockStats = await Promise.all(
      blocks.map(async (b) => {
        const presentInBlock = await prisma.attendance.count({
          where: {
            date: currentDateMidnight,
            status: AttendanceStatus.PRESENT,
            student: { hostelBlockId: b.id },
          },
        });

        const totalInBlock = b._count.students;
        const notGivenInBlock = Math.max(0, totalInBlock - presentInBlock);
        const percentage = totalInBlock > 0 ? Math.round((presentInBlock / totalInBlock) * 100) : 0;

        return {
          blockId: b.id,
          blockCode: b.code,
          blockName: b.name,
          totalResidents: totalInBlock,
          presentCount: presentInBlock,
          notGivenCount: notGivenInBlock,
          percentage,
        };
      })
    );

    const notGivenTotal = Math.max(0, totalStudents - presentToday - onLeaveToday);

    return {
      date: dateStr,
      metrics: {
        totalStudents,
        presentToday,
        notGivenTotal,
        onLeaveToday,
        outOnPassToday,
        pendingReviewToday,
        turnoutPercentage: totalStudents > 0 ? Math.round((presentToday / totalStudents) * 100) : 0,
      },
      blockStats,
    };
  }

  /**
   * Detailed daily attendance report with block/status filtering.
   */
  async getDailyReport(params: {
    date?: string;
    blockId?: string;
    status?: AttendanceStatus;
    page?: number;
    limit?: number;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const skip = (page - 1) * limit;

    const dateStr = params.date || getKolkataDateString();
    const targetDate = new Date(`${dateStr}T00:00:00.000Z`);

    const where: any = {
      date: targetDate,
      ...(params.status ? { status: params.status } : {}),
      ...(params.blockId ? { student: { hostelBlockId: params.blockId } } : {}),
    };

    const [total, records] = await Promise.all([
      prisma.attendance.count({ where }),
      prisma.attendance.findMany({
        where,
        include: {
          student: {
            select: {
              id: true,
              fullName: true,
              registrationNumber: true,
              collegeEmail: true,
              primaryPhone: true,
              academicYear: true,
              branch: true,
              section: true,
              block: { select: { code: true, name: true } },
              room: { select: { roomNumber: true } },
            },
          },
        },
        orderBy: [{ student: { hostelBlockId: 'asc' } }, { student: { room: { roomNumber: 'asc' } } }],
        skip,
        take: limit,
      }),
    ]);

    return {
      date: dateStr,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      records,
    };
  }

  /**
   * Warden/Admin supervised manual override.
   */
  async manualOverride(
    studentId: string,
    dateStr: string,
    status: AttendanceStatus,
    remarks: string,
    wardenId: string,
    wardenRole: string,
    clientIp?: string,
    userAgent?: string
  ) {
    const targetDate = new Date(`${dateStr}T00:00:00.000Z`);

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { block: true, room: true },
    });
    if (!student) {
      throw new NotFoundError('Student not found.');
    }

    const attendance = await prisma.attendance.upsert({
      where: {
        studentId_date: {
          studentId,
          date: targetDate,
        },
      },
      update: {
        status,
        verificationMethod: VerificationMethod.WARDEN_MANUAL_OVERRIDE,
        verifiedById: wardenId,
        remarks,
        updatedAt: new Date(),
      },
      create: {
        studentId,
        date: targetDate,
        latitude: 15.8344,
        longitude: 78.0373,
        accuracyMeters: 5,
        insideGeofence: true,
        faceConfidence: 1.0,
        livenessConfidence: 1.0,
        status,
        verificationMethod: VerificationMethod.WARDEN_MANUAL_OVERRIDE,
        verifiedById: wardenId,
        remarks,
      },
    });

    realtimeEmitter.emitAttendanceRecorded({
      id: attendance.id,
      studentId: student.id,
      registrationNumber: student.registrationNumber,
      studentName: student.fullName,
      blockCode: student.block.code,
      roomNumber: student.room.roomNumber,
      status: attendance.status,
      date: dateStr,
      checkInTime: attendance.checkInTime.toISOString(),
      accuracyMeters: attendance.accuracyMeters,
    });

    await recordAuditLog({
      actorId: wardenId,
      actorRole: wardenRole,
      action: 'ATTENDANCE_MANUAL_OVERRIDE',
      entityName: 'Attendance',
      entityId: attendance.id,
      newState: {
        studentId,
        date: dateStr,
        status,
        remarks,
      },
      ipAddress: clientIp,
      userAgent,
    });

    return attendance;
  }
}

export const attendanceService = new AttendanceService();
