import { Priority } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { realtimeEmitter } from '../../realtime/events.js';
import { recordAuditLog } from '../../utils/audit.js';
import { NotFoundError, BadRequestError } from '../../errors/AppError.js';

export class NoticeVisitorService {
  /**
   * Records an external visitor's arrival and identity proof.
   */
  async logVisitor(
    dto: {
      visitorName: string;
      idProofType: string;
      idProofNumber: string;
      studentId: string;
      purpose: string;
      contactPhone: string;
    },
    recordedById: string,
    recordedByRole: string,
    clientIp?: string,
    userAgent?: string
  ) {
    const student = await prisma.student.findUnique({
      where: { id: dto.studentId },
      include: { block: true, room: true },
    });

    if (!student) {
      throw new NotFoundError('Resident student profile not found.');
    }

    const visitor = await prisma.visitorLog.create({
      data: {
        visitorName: dto.visitorName.trim(),
        idProofType: dto.idProofType,
        idProofNumber: dto.idProofNumber.trim(),
        studentId: student.id,
        blockId: student.hostelBlockId,
        roomId: student.roomId,
        purpose: dto.purpose.trim(),
        contactPhone: dto.contactPhone.trim(),
        recordedById,
      },
      include: {
        student: {
          select: {
            fullName: true,
            registrationNumber: true,
            block: true,
            room: true,
          },
        },
      },
    });

    await recordAuditLog({
      actorId: recordedById,
      actorRole: recordedByRole,
      action: 'VISITOR_LOGGED_IN',
      entityName: 'VisitorLog',
      entityId: visitor.id,
      newState: visitor,
      ipAddress: clientIp,
      userAgent,
    });

    return visitor;
  }

  /**
   * Records visitor departure time.
   */
  async checkOutVisitor(
    visitorId: string,
    recordedById: string,
    recordedByRole: string,
    clientIp?: string,
    userAgent?: string
  ) {
    const existing = await prisma.visitorLog.findUnique({
      where: { id: visitorId },
    });

    if (!existing) {
      throw new NotFoundError('Visitor record not found.');
    }

    if (existing.checkOutTime) {
      throw new BadRequestError('Visitor has already been checked out.');
    }

    const updated = await prisma.visitorLog.update({
      where: { id: visitorId },
      data: {
        checkOutTime: new Date(),
      },
    });

    await recordAuditLog({
      actorId: recordedById,
      actorRole: recordedByRole,
      action: 'VISITOR_CHECKED_OUT',
      entityName: 'VisitorLog',
      entityId: updated.id,
      previousState: existing,
      newState: updated,
      ipAddress: clientIp,
      userAgent,
    });

    return updated;
  }

  /**
   * Lists visitor logs with optional student and active filter.
   */
  async listVisitors(page = 1, limit = 50, activeOnly = false) {
    const skip = (page - 1) * limit;

    const where: any = {
      ...(activeOnly ? { checkOutTime: null } : {}),
    };

    const [total, visitors] = await Promise.all([
      prisma.visitorLog.count({ where }),
      prisma.visitorLog.findMany({
        where,
        orderBy: { checkInTime: 'desc' },
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
      visitors,
    };
  }

  /**
   * Broadcasts safety announcement or curfew notice.
   */
  async createAnnouncement(
    dto: {
      title: string;
      content: string;
      priority?: Priority;
      targetBlockCodes?: string;
      validUntil: string;
    },
    createdById: string,
    createdByRole: string,
    clientIp?: string,
    userAgent?: string
  ) {
    const announcement = await prisma.announcement.create({
      data: {
        title: dto.title.trim(),
        content: dto.content.trim(),
        priority: dto.priority || Priority.MEDIUM,
        targetBlockCodes: dto.targetBlockCodes?.trim() || 'ALL',
        validUntil: new Date(dto.validUntil),
        createdById,
        isActive: true,
      },
    });

    realtimeEmitter.emitAnnouncementBroadcast({
      id: announcement.id,
      title: announcement.title,
      content: announcement.content,
      priority: announcement.priority,
      targetBlockCodes: announcement.targetBlockCodes,
      validUntil: announcement.validUntil.toISOString(),
      createdAt: announcement.createdAt.toISOString(),
    });

    await recordAuditLog({
      actorId: createdById,
      actorRole: createdByRole,
      action: 'ANNOUNCEMENT_BROADCASTED',
      entityName: 'Announcement',
      entityId: announcement.id,
      newState: announcement,
      ipAddress: clientIp,
      userAgent,
    });

    return announcement;
  }

  /**
   * Retrieves active, non-expired announcements.
   */
  async getActiveAnnouncements(studentBlockCode?: string) {
    const now = new Date();

    const announcements = await prisma.announcement.findMany({
      where: {
        isActive: true,
        validUntil: { gte: now },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    // If student, filter announcements meant for their block or ALL
    if (studentBlockCode) {
      return announcements.filter((a) => {
        if (a.targetBlockCodes === 'ALL') return true;
        const targetBlocks = a.targetBlockCodes.split(',').map((b) => b.trim().toUpperCase());
        return targetBlocks.includes(studentBlockCode.toUpperCase());
      });
    }

    return announcements;
  }
}

export const noticeVisitorService = new NoticeVisitorService();
