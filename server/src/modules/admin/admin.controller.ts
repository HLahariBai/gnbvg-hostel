import type { Request, Response, NextFunction } from 'express';
import { adminService } from './admin.service.js';
import { IntrusionStatus } from '@prisma/client';

export class AdminController {
  async getIntrusions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = req.query.status as IntrusionStatus | undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

      const result = await adminService.getIntrusionAttempts(status, page, limit);
      res.status(200).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  }

  async triageIntrusion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const clientIp = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const { id } = req.params;
      const { status, reviewNotes, whitelistData } = req.body;

      const result = await adminService.triageIntrusion(
        id,
        status as IntrusionStatus,
        reviewNotes,
        user.userId,
        user.role,
        whitelistData,
        clientIp,
        userAgent
      );

      res.status(200).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  }

  async addSingleRegistry(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const clientIp = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await adminService.addSingleRegistry(
        req.body,
        user.userId,
        user.role,
        clientIp,
        userAgent
      );

      res.status(201).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  }

  async bulkUploadRegistry(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const clientIp = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await adminService.bulkUploadRegistry(
        req.body.records,
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

  async listRegistry(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const search = req.query.search as string | undefined;
      const blockCode = req.query.blockCode as string | undefined;
      const isRegistered =
        req.query.isRegistered !== undefined ? req.query.isRegistered === 'true' : undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

      const result = await adminService.listRegistry(search, blockCode, isRegistered, page, limit);
      res.status(200).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  }

  async annualRollover(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const clientIp = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await adminService.annualRollover(
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

  async getAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorId = req.query.actorId as string | undefined;
      const action = req.query.action as string | undefined;
      const entityName = req.query.entityName as string | undefined;
      const from = req.query.from as string | undefined;
      const to = req.query.to as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

      const logs = await adminService.getAuditLogs({
        actorId,
        action,
        entityName,
        from,
        to,
        page,
        limit,
      });

      res.status(200).json({ status: 'success', data: logs });
    } catch (err) {
      next(err);
    }
  }

  async getDashboardKPIs(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const kpis = await adminService.getDashboardKPIs();
      res.status(200).json({ status: 'success', data: kpis });
    } catch (err) {
      next(err);
    }
  }
}

export const adminController = new AdminController();
