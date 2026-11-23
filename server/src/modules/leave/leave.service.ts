import { LeaveType, LeaveStatus } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { recordAuditLog } from '../../utils/audit.js';
import { NotFoundError, BadRequestError } from '../../errors/AppError.js';

export class LeaveService {
  async applyLeave(
    studentId: string,
    dto: {
      leaveType: LeaveType;
      reasonCategory: string;
      reasonDetails: string;
      fromDate: string;
      toDate: string;
      expectedReturnDate: string;
      parentConsentVerified?: boolean;
      parentConsentMethod?: string;
    },
    clientIp?: string,
    userAgent?: string
  ) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!student) {
      throw new NotFoundError('Student profile not found.');
    }

    const leave = await prisma.leaveRequest.create({
      data: {
        studentId,
        leaveType: dto.leaveType,
        reasonCategory: dto.reasonCategory.trim(),
        reasonDetails: dto.reasonDetails.trim(),
        fromDate: new Date(dto.fromDate),
        toDate: new Date(dto.toDate),
        expectedReturnDate: new Date(dto.expectedReturnDate),
        parentConsentVerified: dto.parentConsentVerified || false,
        parentConsentMethod: dto.parentConsentMethod || null,
        status: LeaveStatus.PENDING,
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
      actorId: student.userId,
      actorRole: 'STUDENT',
      action: 'LEAVE_REQUEST_APPLIED',
      entityName: 'LeaveRequest',
      entityId: leave.id,
      newState: leave,
      ipAddress: clientIp,
      userAgent,
    });

    return leave;
  }

  async getMyLeaves(studentId: string) {
    return prisma.leaveRequest.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      include: {
        gatePass: true,
      },
    });
  }

  async getAllLeaves(status?: LeaveStatus, blockId?: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const where: any = {
      ...(status ? { status } : {}),
      ...(blockId ? { student: { hostelBlockId: blockId } } : {}),
    };

    const [total, leaves] = await Promise.all([
      prisma.leaveRequest.count({ where }),
      prisma.leaveRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          student: {
            include: {
              block: true,
              room: true,
              parentGuardian: true,
            },
          },
          gatePass: true,
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
      leaves,
    };
  }

  async reviewLeave(
    leaveId: string,
    status: LeaveStatus,
    wardenId: string,
    wardenRole: string,
    decisionRemarks?: string,
    clientIp?: string,
    userAgent?: string
  ) {
    const existing = await prisma.leaveRequest.findUnique({
      where: { id: leaveId },
      include: { student: true },
    });

    if (!existing) {
      throw new NotFoundError('Leave request not found.');
    }

    if (existing.status !== LeaveStatus.PENDING) {
      throw new BadRequestError(`Cannot review leave request with status: ${existing.status}`);
    }

    const updated = await prisma.leaveRequest.update({
      where: { id: leaveId },
      data: {
        status,
        approvedById: wardenId,
        decisionTime: new Date(),
        decisionRemarks,
      },
    });

    await recordAuditLog({
      actorId: wardenId,
      actorRole: wardenRole,
      action: `LEAVE_REQUEST_${status}`,
      entityName: 'LeaveRequest',
      entityId: updated.id,
      previousState: existing,
      newState: updated,
      ipAddress: clientIp,
      userAgent,
    });

    return updated;
  }
}

export const leaveService = new LeaveService();
