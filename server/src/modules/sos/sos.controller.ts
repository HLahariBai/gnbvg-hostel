import type { Request, Response, NextFunction } from 'express';
import { sosService } from './sos.service.js';
import { BadRequestError } from '../../errors/AppError.js';
import { SOSTriggerType } from '@prisma/client';

export class SosController {
  async trigger(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      if (!user.studentId) {
        throw new BadRequestError('Only registered hostellers can trigger an SOS emergency.');
      }

      const clientIp = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const { triggerType, latitude, longitude } = req.body;

      const result = await sosService.triggerSos(
        user.studentId,
        triggerType as SOSTriggerType,
        latitude,
        longitude,
        clientIp,
        userAgent
      );

      res.status(201).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  }

  async getActive(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const alerts = await sosService.getActiveAlerts();
      res.status(200).json({ status: 'success', data: alerts });
    } catch (err) {
      next(err);
    }
  }

  async acknowledge(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const clientIp = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const { id } = req.params;

      const alert = await sosService.acknowledgeAlert(
        id,
        user.userId,
        user.role,
        clientIp,
        userAgent
      );

      res.status(200).json({ status: 'success', data: alert });
    } catch (err) {
      next(err);
    }
  }

  async resolve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const clientIp = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const { id } = req.params;
      const { status, resolutionNotes } = req.body;

      const alert = await sosService.resolveAlert(
        id,
        status,
        resolutionNotes,
        user.userId,
        user.role,
        clientIp,
        userAgent
      );

      res.status(200).json({ status: 'success', data: alert });
    } catch (err) {
      next(err);
    }
  }

  async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

      const history = await sosService.getHistory(page, limit);
      res.status(200).json({ status: 'success', data: history });
    } catch (err) {
      next(err);
    }
  }
}

export const sosController = new SosController();
