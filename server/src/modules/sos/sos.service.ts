import { SOSTriggerType, SOSStatus } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { realtimeEmitter } from '../../realtime/events.js';
import { recordAuditLog } from '../../utils/audit.js';
import { NotFoundError, BadRequestError } from '../../errors/AppError.js';

export class SosService {
  /**
   * Triggers an emergency SOS panic alarm.
   * Immediately records the alert, notifies wardens and admins via real-time WebSockets,
   * and creates an immutable audit trail entry.
   */
  async triggerSos(
    studentId: string,
    triggerType: SOSTriggerType = SOSTriggerType.INSTANT,
    latitude?: number,
    longitude?: number,
    clientIp?: string,
    userAgent?: string
  ) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        block: true,
        room: true,
        parentGuardian: true,
      },
    });

    if (!student) {
      throw new NotFoundError('Student profile not found.');
    }

    const alert = await prisma.sOSAlert.create({
      data: {
        studentId: student.id,
        blockId: student.hostelBlockId,
        roomId: student.roomId,
        latitude: latitude || null,
        longitude: longitude || null,
        triggerType,
        status: SOSStatus.TRIGGERED,
      },
      include: {
        block: true,
        room: true,
      },
    });

    // Real-Time Broadcast immediately after database commit
    const primaryParentPhone =
      student.parentGuardian?.fatherPhone ||
      student.parentGuardian?.motherPhone ||
      student.parentGuardian?.guardianPhone ||
      undefined;

    realtimeEmitter.emitSosTriggered({
      id: alert.id,
      studentId: student.id,
      studentName: student.fullName,
      registrationNumber: student.registrationNumber,
      blockCode: student.block.code,
      blockName: student.block.name,
      roomNumber: student.room.roomNumber,
      parentPhone: primaryParentPhone,
      latitude: alert.latitude,
      longitude: alert.longitude,
      triggerType: alert.triggerType,
      status: alert.status,
      createdAt: alert.createdAt.toISOString(),
    });

    await recordAuditLog({
      actorId: student.userId,
      actorRole: 'STUDENT',
      action: 'SOS_EMERGENCY_TRIGGERED',
      entityName: 'SOSAlert',
      entityId: alert.id,
      newState: {
        studentId: student.id,
        block: student.block.name,
        room: student.room.roomNumber,
        triggerType,
      },
      ipAddress: clientIp,
      userAgent,
    });

    console.log(`\n🚨 [HIGH PRIORITY SOS] Student ${student.fullName} (${student.registrationNumber}) in Block ${student.block.code} Room ${student.room.roomNumber} triggered ${triggerType} SOS!\n`);

    return {
      success: true,
      message: 'EMERGENCY SOS ALERT DISPATCHED. Warden and campus security teams have been notified.',
      alert,
    };
  }

  /**
   * Retrieves all currently active (TRIGGERED or ACKNOWLEDGED) SOS alerts for the live dashboard.
   */
  async getActiveAlerts() {
    return prisma.sOSAlert.findMany({
      where: {
        status: { in: [SOSStatus.TRIGGERED, SOSStatus.ACKNOWLEDGED] },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            registrationNumber: true,
            collegeEmail: true,
            primaryPhone: true,
            parentGuardian: true,
            block: true,
            room: true,
          },
        },
        block: true,
        room: true,
      },
    });
  }

  /**
   * Warden acknowledges an active SOS alert.
   */
  async acknowledgeAlert(
    alertId: string,
    wardenId: string,
    wardenRole: string,
    clientIp?: string,
    userAgent?: string
  ) {
    const existing = await prisma.sOSAlert.findUnique({
      where: { id: alertId },
      include: { student: true, block: true },
    });

    if (!existing) {
      throw new NotFoundError('SOS alert not found.');
    }

    if (existing.status !== SOSStatus.TRIGGERED) {
      throw new BadRequestError(`Cannot acknowledge an alert with status: ${existing.status}`);
    }

    const updated = await prisma.sOSAlert.update({
      where: { id: alertId },
      data: {
        status: SOSStatus.ACKNOWLEDGED,
        acknowledgedById: wardenId,
        acknowledgedAt: new Date(),
      },
    });

    realtimeEmitter.emitSosUpdated({
      id: updated.id,
      status: updated.status,
      studentId: existing.studentId,
    });

    await recordAuditLog({
      actorId: wardenId,
      actorRole: wardenRole,
      action: 'SOS_ALERT_ACKNOWLEDGED',
      entityName: 'SOSAlert',
      entityId: updated.id,
      previousState: existing,
      newState: updated,
      ipAddress: clientIp,
      userAgent,
    });

    return updated;
  }

  /**
   * Warden resolves an SOS alert with formal resolution notes.
   */
  async resolveAlert(
    alertId: string,
    status: 'RESOLVED' | 'FALSE_ALARM',
    resolutionNotes: string,
    wardenId: string,
    wardenRole: string,
    clientIp?: string,
    userAgent?: string
  ) {
    const existing = await prisma.sOSAlert.findUnique({
      where: { id: alertId },
      include: { student: true },
    });

    if (!existing) {
      throw new NotFoundError('SOS alert not found.');
    }

    const targetStatus = status === 'RESOLVED' ? SOSStatus.RESOLVED : SOSStatus.FALSE_ALARM;

    const updated = await prisma.sOSAlert.update({
      where: { id: alertId },
      data: {
        status: targetStatus,
        resolvedById: wardenId,
        resolvedAt: new Date(),
        resolutionNotes,
      },
    });

    realtimeEmitter.emitSosUpdated({
      id: updated.id,
      status: updated.status,
      studentId: existing.studentId,
    });

    await recordAuditLog({
      actorId: wardenId,
      actorRole: wardenRole,
      action: `SOS_ALERT_${targetStatus}`,
      entityName: 'SOSAlert',
      entityId: updated.id,
      previousState: existing,
      newState: updated,
      ipAddress: clientIp,
      userAgent,
    });

    return updated;
  }

  /**
   * Retrieves historical SOS alerts with pagination.
   */
  async getHistory(page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [total, alerts] = await Promise.all([
      prisma.sOSAlert.count(),
      prisma.sOSAlert.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          student: {
            select: {
              fullName: true,
              registrationNumber: true,
              primaryPhone: true,
              block: true,
              room: true,
            },
          },
          block: true,
          room: true,
        },
        skip,
        take: limit,
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      alerts,
    };
  }
}

export const sosService = new SosService();
