import type { Request, Response, NextFunction } from 'express';
import { attendanceService } from './attendance.service.js';
import { BadRequestError } from '../../errors/AppError.js';
import { AttendanceStatus } from '@prisma/client';

export class AttendanceController {
  async checkIn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      if (!user.studentId) {
        throw new BadRequestError('Only registered students can submit attendance.');
      }

      const clientIp = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await attendanceService.recordAttendance(
        user.studentId,
        req.body,
        clientIp,
        userAgent
      );

      res.status(200).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  }

  async getTodayStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      if (!user.studentId) {
        throw new BadRequestError('Student ID not found in session.');
      }

      const status = await attendanceService.getTodayStatus(user.studentId);
      res.status(200).json({ status: 'success', data: status });
    } catch (err) {
      next(err);
    }
  }

  async getMyHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      if (!user.studentId) {
        throw new BadRequestError('Student ID not found in session.');
      }

      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 30;

      const history = await attendanceService.getMyHistory(user.studentId, page, limit);
      res.status(200).json({ status: 'success', data: history });
    } catch (err) {
      next(err);
    }
  }

  async getLiveSummary(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = await attendanceService.getLiveSummary();
      res.status(200).json({ status: 'success', data: summary });
    } catch (err) {
      next(err);
    }
  }

  async getDailyReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const date = req.query.date as string | undefined;
      const blockId = req.query.blockId as string | undefined;
      const status = req.query.status as AttendanceStatus | undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

      const report = await attendanceService.getDailyReport({
        date,
        blockId,
        status,
        page,
        limit,
      });

      res.status(200).json({ status: 'success', data: report });
    } catch (err) {
      next(err);
    }
  }

  async manualOverride(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const clientIp = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const { studentId, date, status, remarks } = req.body;

      const result = await attendanceService.manualOverride(
        studentId,
        date,
        status,
        remarks,
        user.userId,
        user.role,
        clientIp,
        userAgent
      );

      res.status(200).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  }
}

export const attendanceController = new AttendanceController();
