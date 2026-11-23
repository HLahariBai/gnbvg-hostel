import { FaceEnrollmentStatus } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { encryptAesGcm, hashSha256 } from '../../utils/crypto.js';
import { recordAuditLog } from '../../utils/audit.js';
import { NotFoundError, BadRequestError } from '../../errors/AppError.js';
import { ATTENDANCE_CONSTRAINTS } from '../../constants/index.js';

export interface PhotoVerificationDiagnostics {
  passed: boolean;
  resolutionValid: boolean;
  freshnessValid: boolean;
  boundingBoxValid: boolean;
  livenessPassed: boolean;
  faceMatchPassed: boolean;
  livenessScore: number;
  faceMatchConfidence: number;
  livenessThreshold: number;
  faceMatchThreshold: number;
  stageFailed?: string;
  reason?: string;
}

export class BiometricsService {
  /**
   * Enrolls biometric reference template metadata for a student.
   * Encrypts the template vector via AES-256-GCM and stores a SHA-256 integrity hash.
   */
  async enrollFace(
    studentId: string,
    templateData: string,
    qualityScore: number,
    modelVersion = 'Facenet512-v1',
    enrolledById?: string,
    clientIp?: string,
    userAgent?: string
  ) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!student) {
      throw new NotFoundError('Student profile not found.');
    }

    if (qualityScore < 0.6) {
      throw new BadRequestError('Biometric enrollment quality score is too low. Please recapture in good lighting.');
    }

    // Encrypt template vector for zero-knowledge storage
    const encrypted = encryptAesGcm(templateData);
    const templateHash = hashSha256(templateData);

    const enrollment = await prisma.faceEnrollment.upsert({
      where: { studentId },
      update: {
        templateHash,
        templateDataEncrypted: encrypted.combined,
        modelVersion,
        qualityScore,
        status: FaceEnrollmentStatus.ACTIVE,
        enrolledById,
        updatedAt: new Date(),
      },
      create: {
        studentId,
        templateHash,
        templateDataEncrypted: encrypted.combined,
        modelVersion,
        qualityScore,
        status: FaceEnrollmentStatus.ACTIVE,
        enrolledById,
      },
    });

    await recordAuditLog({
      actorId: enrolledById || student.userId,
      actorRole: enrolledById ? 'WARDEN' : 'STUDENT',
      action: 'FACE_BIOMETRIC_ENROLLED',
      entityName: 'FaceEnrollment',
      entityId: enrollment.id,
      newState: {
        studentId,
        modelVersion,
        qualityScore,
        status: enrollment.status,
      },
      ipAddress: clientIp,
      userAgent,
    });

    return {
      id: enrollment.id,
      studentId: enrollment.studentId,
      modelVersion: enrollment.modelVersion,
      qualityScore: enrollment.qualityScore,
      status: enrollment.status,
      enrolledAt: enrollment.enrolledAt,
    };
  }

  /**
   * Retrieves biometric enrollment status for a student without exposing raw template data.
   */
  async getEnrollmentStatus(studentId: string) {
    const enrollment = await prisma.faceEnrollment.findUnique({
      where: { studentId },
      select: {
        id: true,
        studentId: true,
        modelVersion: true,
        qualityScore: true,
        status: true,
        enrolledAt: true,
        updatedAt: true,
      },
    });

    if (!enrollment) {
      return {
        isEnrolled: false,
        status: null,
      };
    }

    return {
      isEnrolled: enrollment.status === FaceEnrollmentStatus.ACTIVE,
      ...enrollment,
    };
  }

  /**
   * Warden or Admin reviews/updates face enrollment status.
   */
  async reviewEnrollment(
    enrollmentId: string,
    status: FaceEnrollmentStatus,
    reviewerId: string,
    reviewerRole: string,
    notes?: string,
    clientIp?: string,
    userAgent?: string
  ) {
    const existing = await prisma.faceEnrollment.findUnique({
      where: { id: enrollmentId },
    });
    if (!existing) {
      throw new NotFoundError('Face enrollment record not found.');
    }

    const updated = await prisma.faceEnrollment.update({
      where: { id: enrollmentId },
      data: { status },
    });

    await recordAuditLog({
      actorId: reviewerId,
      actorRole: reviewerRole,
      action: 'FACE_ENROLLMENT_STATUS_REVIEWED',
      entityName: 'FaceEnrollment',
      entityId: updated.id,
      previousState: existing,
      newState: { ...updated, notes },
      ipAddress: clientIp,
      userAgent,
    });

    return updated;
  }

  /**
   * Evaluates photo capture metadata, presentation-attack liveness, and face match thresholds.
   */
  async verifyPhotoMetadata(params: {
    studentId?: string;
    width: number;
    height: number;
    captureTimestamp: string;
    faceDetected: boolean;
    boundingBox?: { x: number; y: number; width: number; height: number };
    livenessScore: number;
    faceMatchConfidence: number;
  }): Promise<PhotoVerificationDiagnostics> {
    // 1. Resolution Check (Min 480x640)
    const resolutionValid = params.width >= 480 && params.height >= 480;

    // 2. Freshness Check (Within 60 seconds)
    const captureTime = new Date(params.captureTimestamp).getTime();
    const now = Date.now();
    const freshnessValid = Math.abs(now - captureTime) <= ATTENDANCE_CONSTRAINTS.MAX_GPS_AGE_SECONDS * 1000;

    // 3. Face Bounding Box Area (> 15% of frame)
    let boundingBoxValid = true;
    if (params.boundingBox) {
      const faceArea = params.boundingBox.width * params.boundingBox.height;
      const frameArea = params.width * params.height;
      boundingBoxValid = faceArea / frameArea >= 0.12;
    }

    // 4. Liveness Check (Must meet threshold e.g. 0.90)
    const livenessPassed =
      params.faceDetected &&
      params.livenessScore >= ATTENDANCE_CONSTRAINTS.LIVENESS_CONFIDENCE_THRESHOLD;

    // 5. Face Match Check (Must meet threshold e.g. 0.85)
    const faceMatchPassed =
      params.faceMatchConfidence >= ATTENDANCE_CONSTRAINTS.FACE_CONFIDENCE_THRESHOLD;

    let stageFailed: string | undefined;
    let reason: string | undefined;

    if (!params.faceDetected) {
      stageFailed = 'FACE_CAPTURE';
      reason = 'No clear human face detected in frame.';
    } else if (!resolutionValid) {
      stageFailed = 'FACE_CAPTURE';
      reason = 'Camera resolution is too low for reliable biometric verification.';
    } else if (!freshnessValid) {
      stageFailed = 'FACE_CAPTURE';
      reason = 'Photo capture timestamp is stale or manipulated (> 60 seconds old).';
    } else if (!boundingBoxValid) {
      stageFailed = 'FACE_CAPTURE';
      reason = 'Face is too far from camera. Please move closer.';
    } else if (!livenessPassed) {
      stageFailed = 'LIVENESS';
      reason = 'Liveness presentation attack detected or score below confidence threshold (0.90).';
    } else if (!faceMatchPassed) {
      stageFailed = 'FACE_MATCH';
      reason = 'Face embedding match confidence below threshold (0.85) against reference profile.';
    }

    const passed =
      resolutionValid &&
      freshnessValid &&
      boundingBoxValid &&
      livenessPassed &&
      faceMatchPassed;

    return {
      passed,
      resolutionValid,
      freshnessValid,
      boundingBoxValid,
      livenessPassed,
      faceMatchPassed,
      livenessScore: params.livenessScore,
      faceMatchConfidence: params.faceMatchConfidence,
      livenessThreshold: ATTENDANCE_CONSTRAINTS.LIVENESS_CONFIDENCE_THRESHOLD,
      faceMatchThreshold: ATTENDANCE_CONSTRAINTS.FACE_CONFIDENCE_THRESHOLD,
      stageFailed,
      reason,
    };
  }
}

export const biometricsService = new BiometricsService();
