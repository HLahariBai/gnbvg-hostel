import type { Request, Response, NextFunction } from 'express';
import { noticeVisitorService } from './noticeVisitor.service.js';
import { prisma } from '../../config/database.js';
import { Priority } from '@prisma/client';

export class NoticeVisitorController {
  async logVisitor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const clientIp = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const visitor = await noticeVisitorService.logVisitor(
        req.body,
        user.userId,
        user.role,
        clientIp,
        userAgent
      );

      res.status(201).json({ status: 'success', data: visitor });
    } catch (err) {
      next(err);
    }
  }

  async checkOutVisitor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const clientIp = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const { id } = req.params;

      const visitor = await noticeVisitorService.checkOutVisitor(
        id,
        user.userId,
        user.role,
        clientIp,
        userAgent
      );

      res.status(200).json({ status: 'success', data: visitor });
    } catch (err) {
      next(err);
    }
  }

  async listVisitors(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const activeOnly = req.query.activeOnly === 'true';

      const result = await noticeVisitorService.listVisitors(page, limit, activeOnly);
      res.status(200).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  }

  async createAnnouncement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const clientIp = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const announcement = await noticeVisitorService.createAnnouncement(
        {
          ...req.body,
          priority: req.body.priority as Priority,
        },
        user.userId,
        user.role,
        clientIp,
        userAgent
      );

      res.status(201).json({ status: 'success', data: announcement });
    } catch (err) {
      next(err);
    }
  }

  async getAnnouncements(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      let blockCode: string | undefined;

      if (user && user.role === 'STUDENT' && user.studentId) {
        // Find student block code
        const student = await prisma.student.findUnique({
          where: { id: user.studentId },
          include: { block: true },
        });
        blockCode = student?.block?.code;
      }

      const announcements = await noticeVisitorService.getActiveAnnouncements(blockCode);
      res.status(200).json({ status: 'success', data: announcements });
    } catch (err) {
      next(err);
    }
  }
}

export const noticeVisitorController = new NoticeVisitorController();
