import { GatePassType, GatePassStatus, MovementEventType } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { generateHmac, verifyHmac, generateSecureToken } from '../../utils/crypto.js';
import { env } from '../../config/env.js';
import { realtimeEmitter } from '../../realtime/events.js';
import { recordAuditLog } from '../../utils/audit.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../errors/AppError.js';

export class MovementService {
  /**
   * Student applies for Day Pass or Night Out Pass.
   */
  async applyPass(
    studentId: string,
    dto: {
      passType: GatePassType;
      destination: string;
      reason: string;
      validFrom: string;
      validUntil: string;
      parentConfirmed?: boolean;
    },
    clientIp?: string,
    userAgent?: string
  ) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { block: true, room: true },
    });
    if (!student) {
      throw new NotFoundError('Student profile not found.');
    }

    // Check if student already has an active or pending pass
    const activePass = await prisma.gatePass.findFirst({
      where: {
        studentId,
        status: { in: [GatePassStatus.PENDING, GatePassStatus.APPROVED, GatePassStatus.CHECKED_OUT] },
      },
    });

    if (activePass) {
      throw new BadRequestError(
        `You already have an existing pass (${activePass.passNumber}) with status ${activePass.status}. Cannot apply for another until it is completed.`
      );
    }

    // Generate unique sequential Pass Number e.g. "GP-2026-A1B2C3"
    const passCode = generateSecureToken(3).toUpperCase();
    const passNumber = `GP-${new Date().getFullYear()}-${passCode}`;

    // Preliminary QR payload (before warden approval signature)
    const initialQrData = `PENDING:${passNumber}:${student.registrationNumber}`;

    const pass = await prisma.gatePass.create({
      data: {
        passNumber,
        studentId: student.id,
        passType: dto.passType,
        destination: dto.destination.trim(),
        reason: dto.reason.trim(),
        validFrom: new Date(dto.validFrom),
        validUntil: new Date(dto.validUntil),
        parentConfirmed: dto.parentConfirmed || false,
        status: GatePassStatus.PENDING,
        qrCodeSignature: initialQrData,
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

    realtimeEmitter.emitGatePassStatusChanged({
      id: pass.id,
      passNumber: pass.passNumber,
      studentId: student.id,
      studentName: student.fullName,
      passType: pass.passType,
      destination: pass.destination,
      status: pass.status,
      validUntil: pass.validUntil.toISOString(),
      updatedAt: pass.updatedAt.toISOString(),
    });

    await recordAuditLog({
      actorId: student.userId,
      actorRole: 'STUDENT',
      action: 'GATE_PASS_APPLIED',
      entityName: 'GatePass',
      entityId: pass.id,
      newState: pass,
      ipAddress: clientIp,
      userAgent,
    });

    return pass;
  }

  /**
   * Retrieves pass history for the authenticated student.
   */
  async getMyPasses(studentId: string) {
    return prisma.gatePass.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      include: {
        movementEvents: {
          orderBy: { recordedAt: 'asc' },
        },
      },
    });
  }

  /**
   * Retrieves pending gate passes for warden approval queue.
   */
  async getPendingPasses() {
    return prisma.gatePass.findMany({
      where: { status: GatePassStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            registrationNumber: true,
            primaryPhone: true,
            academicYear: true,
            branch: true,
            section: true,
            block: true,
            room: true,
            parentGuardian: true,
          },
        },
      },
    });
  }

  /**
   * Warden reviews (approves/rejects) a gate pass.
   * On approval, generates a cryptographically signed HMAC-SHA-256 QR code payload.
   */
  async reviewPass(
    passId: string,
    decision: 'APPROVE' | 'REJECT',
    wardenId: string,
    wardenRole: string,
    remarks?: string,
    clientIp?: string,
    userAgent?: string
  ) {
    const pass = await prisma.gatePass.findUnique({
      where: { id: passId },
      include: { student: true },
    });

    if (!pass) {
      throw new NotFoundError('Gate pass not found.');
    }

    if (pass.status !== GatePassStatus.PENDING) {
      throw new BadRequestError(`Cannot review pass with current status: ${pass.status}`);
    }

    const newStatus = decision === 'APPROVE' ? GatePassStatus.APPROVED : GatePassStatus.REJECTED;

    let qrCodeSignature = pass.qrCodeSignature;
    if (newStatus === GatePassStatus.APPROVED) {
      // Create HMAC signature: passNumber + studentId + validUntil
      const payloadString = `${pass.passNumber}:${pass.studentId}:${pass.validUntil.getTime()}`;
      const signature = generateHmac(payloadString, env.QR_SIGNING_SECRET);
      qrCodeSignature = `GNBVG:${pass.passNumber}:${pass.studentId}:${pass.validUntil.getTime()}:${signature}`;
    }

    const updated = await prisma.gatePass.update({
      where: { id: passId },
      data: {
        status: newStatus,
        approvedById: wardenId,
        qrCodeSignature,
      },
    });

    realtimeEmitter.emitGatePassStatusChanged({
      id: updated.id,
      passNumber: updated.passNumber,
      studentId: pass.studentId,
      studentName: pass.student.fullName,
      passType: updated.passType,
      destination: updated.destination,
      status: updated.status,
      validUntil: updated.validUntil.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });

    await recordAuditLog({
      actorId: wardenId,
      actorRole: wardenRole,
      action: `GATE_PASS_${newStatus}`,
      entityName: 'GatePass',
      entityId: updated.id,
      previousState: pass,
      newState: { ...updated, remarks },
      ipAddress: clientIp,
      userAgent,
    });

    return updated;
  }

  /**
   * Verifies a digital QR code presented at the gate.
   */
  async verifyQrCode(qrData: string) {
    const parts = qrData.split(':');
    if (parts.length !== 5 || parts[0] !== 'GNBVG') {
      throw new BadRequestError('Invalid or malformed Gate Pass QR code.');
    }

    const [, passNumber, studentId, validUntilTimestampStr, signature] = parts;
    const payloadString = `${passNumber}:${studentId}:${validUntilTimestampStr}`;

    const isValidSig = verifyHmac(payloadString, signature, env.QR_SIGNING_SECRET);
    if (!isValidSig) {
      throw new ForbiddenError('TAMPER ALERT: QR Code digital HMAC signature verification failed!');
    }

    const pass = await prisma.gatePass.findUnique({
      where: { passNumber },
      include: {
        student: {
          include: {
            block: true,
            room: true,
            parentGuardian: true,
          },
        },
      },
    });

    if (!pass) {
      throw new NotFoundError('Pass not found in system.');
    }

    const now = Date.now();
    const validUntil = new Date(pass.validUntil).getTime();
    const isExpired = now > validUntil;

    return {
      isValid: true,
      isExpired,
      status: pass.status,
      pass,
    };
  }

  /**
   * Gate security / warden records student Check-Out departure.
   */
  async checkOut(
    passId: string,
    recordedById: string,
    checkpointLocation = 'MAIN_HOSTEL_GATE',
    latitude?: number,
    longitude?: number,
    remarks?: string
  ) {
    const pass = await prisma.gatePass.findUnique({
      where: { id: passId },
      include: { student: true },
    });

    if (!pass) {
      throw new NotFoundError('Gate pass not found.');
    }

    if (pass.status !== GatePassStatus.APPROVED) {
      throw new BadRequestError(`Cannot check out with pass status: ${pass.status}. Pass must be APPROVED.`);
    }

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const updatedPass = await tx.gatePass.update({
        where: { id: passId },
        data: {
          status: GatePassStatus.CHECKED_OUT,
          checkedOutAt: now,
        },
      });

      const movement = await tx.movementEvent.create({
        data: {
          studentId: pass.studentId,
          gatePassId: pass.id,
          eventType: MovementEventType.CHECK_OUT,
          recordedAt: now,
          recordedById,
          checkpointLocation,
          latitude: latitude || null,
          longitude: longitude || null,
          remarks,
        },
      });

      return { pass: updatedPass, movement };
    });

    realtimeEmitter.emitGatePassStatusChanged({
      id: result.pass.id,
      passNumber: result.pass.passNumber,
      studentId: pass.studentId,
      studentName: pass.student.fullName,
      passType: result.pass.passType,
      destination: result.pass.destination,
      status: result.pass.status,
      validUntil: result.pass.validUntil.toISOString(),
      updatedAt: result.pass.updatedAt.toISOString(),
    });

    return result;
  }

  /**
   * Gate security / warden records student Check-In return.
   */
  async checkIn(
    passId: string,
    recordedById: string,
    checkpointLocation = 'MAIN_HOSTEL_GATE',
    latitude?: number,
    longitude?: number,
    remarks?: string
  ) {
    const pass = await prisma.gatePass.findUnique({
      where: { id: passId },
      include: { student: true },
    });

    if (!pass) {
      throw new NotFoundError('Gate pass not found.');
    }

    if (pass.status !== GatePassStatus.CHECKED_OUT) {
      throw new BadRequestError(`Cannot check in pass with status: ${pass.status}. Student is not checked out.`);
    }

    const now = new Date();
    const isOverdue = now > pass.validUntil;

    const result = await prisma.$transaction(async (tx) => {
      const updatedPass = await tx.gatePass.update({
        where: { id: passId },
        data: {
          status: GatePassStatus.RETURNED,
          returnedAt: now,
        },
      });

      const movement = await tx.movementEvent.create({
        data: {
          studentId: pass.studentId,
          gatePassId: pass.id,
          eventType: MovementEventType.CHECK_IN,
          recordedAt: now,
          recordedById,
          checkpointLocation,
          latitude: latitude || null,
          longitude: longitude || null,
          remarks: isOverdue
            ? `OVERDUE RETURN (${Math.round((now.getTime() - pass.validUntil.getTime()) / 60000)} mins late). ${remarks || ''}`
            : remarks,
        },
      });

      return { pass: updatedPass, movement, isOverdue };
    });

    realtimeEmitter.emitGatePassStatusChanged({
      id: result.pass.id,
      passNumber: result.pass.passNumber,
      studentId: pass.studentId,
      studentName: pass.student.fullName,
      passType: result.pass.passType,
      destination: result.pass.destination,
      status: result.pass.status,
      validUntil: result.pass.validUntil.toISOString(),
      updatedAt: result.pass.updatedAt.toISOString(),
    });

    return result;
  }

  /**
   * Retrieves overdue hostellers who have checked out but not returned past their validUntil timestamp.
   */
  async getOverduePasses() {
    const now = new Date();

    return prisma.gatePass.findMany({
      where: {
        status: GatePassStatus.CHECKED_OUT,
        validUntil: { lt: now },
      },
      include: {
        student: {
          include: {
            block: true,
            room: true,
            parentGuardian: true,
          },
        },
      },
      orderBy: { validUntil: 'asc' },
    });
  }
}

export const movementService = new MovementService();
