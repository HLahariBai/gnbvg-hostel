import type { Request, Response, NextFunction } from 'express';
import { safetyService } from './safety.service.js';
import { BadRequestError } from '../../errors/AppError.js';
import { TicketCategory, TicketStatus, Priority } from '@prisma/client';

export class SafetyController {
  async createTicket(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      if (!user.studentId) {
        throw new BadRequestError('Only registered hostellers can file a safety or maintenance report.');
      }

      const clientIp = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const ticket = await safetyService.createTicket(
        user.studentId,
        req.body,
        clientIp,
        userAgent
      );

      res.status(201).json({ status: 'success', data: ticket });
    } catch (err) {
      next(err);
    }
  }

  async getMyTickets(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      if (!user.studentId) {
        throw new BadRequestError('Student ID not found in session.');
      }

      const tickets = await safetyService.getMyTickets(user.studentId);
      res.status(200).json({ status: 'success', data: tickets });
    } catch (err) {
      next(err);
    }
  }

  async getAllTickets(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = req.query.status as TicketStatus | undefined;
      const category = req.query.category as TicketCategory | undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

      const result = await safetyService.getAllTickets(status, category, page, limit);
      res.status(200).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  }

  async updateTicketStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const clientIp = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const { id } = req.params;
      const { status, priority, assignedToId, resolutionSummary } = req.body;

      const updated = await safetyService.updateTicketStatus(
        id,
        status as TicketStatus,
        user.userId,
        user.role,
        priority as Priority,
        assignedToId,
        resolutionSummary,
        clientIp,
        userAgent
      );

      res.status(200).json({ status: 'success', data: updated });
    } catch (err) {
      next(err);
    }
  }
}

export const safetyController = new SafetyController();
