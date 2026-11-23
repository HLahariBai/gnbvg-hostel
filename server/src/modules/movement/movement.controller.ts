import type { Request, Response, NextFunction } from 'express';
import { movementService } from './movement.service.js';
import { BadRequestError } from '../../errors/AppError.js';

export class MovementController {
  async applyPass(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      if (!user.studentId) {
        throw new BadRequestError('Only registered hostellers can apply for a gate pass.');
      }

      const clientIp = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const pass = await movementService.applyPass(
        user.studentId,
        req.body,
        clientIp,
        userAgent
      );

      res.status(201).json({ status: 'success', data: pass });
    } catch (err) {
      next(err);
    }
  }

  async getMyPasses(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      if (!user.studentId) {
        throw new BadRequestError('Student ID not found in session.');
      }

      const passes = await movementService.getMyPasses(user.studentId);
      res.status(200).json({ status: 'success', data: passes });
    } catch (err) {
      next(err);
    }
  }

  async getPendingPasses(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const passes = await movementService.getPendingPasses();
      res.status(200).json({ status: 'success', data: passes });
    } catch (err) {
      next(err);
    }
  }

  async reviewPass(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const clientIp = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const { id } = req.params;
      const { decision, remarks } = req.body;

      const pass = await movementService.reviewPass(
        id,
        decision,
        user.userId,
        user.role,
        remarks,
        clientIp,
        userAgent
      );

      res.status(200).json({ status: 'success', data: pass });
    } catch (err) {
      next(err);
    }
  }

  async verifyQr(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { qrData } = req.body;
      const verification = await movementService.verifyQrCode(qrData);
      res.status(200).json({ status: 'success', data: verification });
    } catch (err) {
      next(err);
    }
  }

  async checkOut(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const { id } = req.params;
      const { checkpointLocation, latitude, longitude, remarks } = req.body;

      const result = await movementService.checkOut(
        id,
        user.userId,
        checkpointLocation,
        latitude,
        longitude,
        remarks
      );

      res.status(200).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  }

  async checkIn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const { id } = req.params;
      const { checkpointLocation, latitude, longitude, remarks } = req.body;

      const result = await movementService.checkIn(
        id,
        user.userId,
        checkpointLocation,
        latitude,
        longitude,
        remarks
      );

      res.status(200).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  }

  async getOverduePasses(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const overdue = await movementService.getOverduePasses();
      res.status(200).json({ status: 'success', data: overdue });
    } catch (err) {
      next(err);
    }
  }
}

export const movementController = new MovementController();
