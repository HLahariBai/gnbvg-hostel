import type { Request, Response, NextFunction } from 'express';
import { biometricsService } from './biometrics.service.js';
import { BadRequestError } from '../../errors/AppError.js';
import { FaceEnrollmentStatus } from '@prisma/client';

export class BiometricsController {
  async enrollFace(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const clientIp = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const { templateData, qualityScore, modelVersion } = req.body;

      // Determine target student ID
      let studentId = req.body.studentId;
      if (!studentId) {
        if (user.role === 'STUDENT' && user.studentId) {
          studentId = user.studentId;
        } else {
          throw new BadRequestError('Target studentId is required for biometric enrollment.');
        }
      }

      const enrolledById = user.role !== 'STUDENT' ? user.userId : undefined;

      const result = await biometricsService.enrollFace(
        studentId,
        templateData,
        qualityScore,
        modelVersion,
        enrolledById,
        clientIp,
        userAgent
      );

      res.status(201).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  }

  async getEnrollmentStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      let studentId = req.params.studentId;

      if (!studentId) {
        if (user.role === 'STUDENT' && user.studentId) {
          studentId = user.studentId;
        } else {
          throw new BadRequestError('studentId parameter is required.');
        }
      }

      const status = await biometricsService.getEnrollmentStatus(studentId);
      res.status(200).json({ status: 'success', data: status });
    } catch (err) {
      next(err);
    }
  }

  async reviewEnrollment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const clientIp = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const { enrollmentId } = req.params;
      const { status, notes } = req.body;

      const result = await biometricsService.reviewEnrollment(
        enrollmentId,
        status as FaceEnrollmentStatus,
        user.userId,
        user.role,
        notes,
        clientIp,
        userAgent
      );

      res.status(200).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  }

  async verifyPhotoMetadata(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await biometricsService.verifyPhotoMetadata(req.body);
      res.status(200).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  }
}

export const biometricsController = new BiometricsController();
