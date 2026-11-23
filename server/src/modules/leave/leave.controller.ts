import type { Request, Response, NextFunction } from 'express';
import { leaveService } from './leave.service.js';
import { BadRequestError } from '../../errors/AppError.js';
import { LeaveStatus } from '@prisma/client';

export class LeaveController {
  async applyLeave(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      if (!user.studentId) {
        throw new BadRequestError('Only registered hostellers can apply for leave.');
      }

      const clientIp = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const leave = await leaveService.applyLeave(
        user.studentId,
        req.body,
        clientIp,
        userAgent
      );

      res.status(201).json({ status: 'success', data: leave });
    } catch (err) {
      next(err);
    }
  }

  async getMyLeaves(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      if (!user.studentId) {
        throw new BadRequestError('Student ID not found in session.');
      }

      const leaves = await leaveService.getMyLeaves(user.studentId);
      res.status(200).json({ status: 'success', data: leaves });
    } catch (err) {
      next(err);
    }
  }

  async getAllLeaves(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = req.query.status as LeaveStatus | undefined;
      const blockId = req.query.blockId as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

      const result = await leaveService.getAllLeaves(status, blockId, page, limit);
      res.status(200).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  }

  async reviewLeave(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const clientIp = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const { id } = req.params;
      const { status, decisionRemarks } = req.body;

      const leave = await leaveService.reviewLeave(
        id,
        status as LeaveStatus,
        user.userId,
        user.role,
        decisionRemarks,
        clientIp,
        userAgent
      );

      res.status(200).json({ status: 'success', data: leave });
    } catch (err) {
      next(err);
    }
  }
}

export const leaveController = new LeaveController();
