import type { Request, Response, NextFunction } from 'express';
import { hostelService } from './hostel.service.js';

export class HostelController {
  async getConfig(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const config = await hostelService.getOrCreateHostelConfig();
      res.status(200).json({ status: 'success', data: config });
    } catch (err) {
      next(err);
    }
  }

  async updateConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const clientIp = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const updated = await hostelService.updateHostelConfig(
        req.body,
        user.userId,
        user.role,
        clientIp,
        userAgent
      );
      res.status(200).json({ status: 'success', data: updated });
    } catch (err) {
      next(err);
    }
  }

  async testGeofencePoint(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { latitude, longitude, accuracyMeters } = req.body;
      const result = await hostelService.testGeofencePoint(latitude, longitude, accuracyMeters);
      res.status(200).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  }

  async listBlocks(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const blocks = await hostelService.listBlocks();
      res.status(200).json({ status: 'success', data: blocks });
    } catch (err) {
      next(err);
    }
  }

  async listRooms(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { blockId } = req.params;
      const floor = req.query.floorNumber ? parseInt(req.query.floorNumber as string, 10) : undefined;
      const rooms = await hostelService.listRooms(blockId, floor);
      res.status(200).json({ status: 'success', data: rooms });
    } catch (err) {
      next(err);
    }
  }

  async createRoom(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const clientIp = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const room = await hostelService.createRoom(
        req.body,
        user.userId,
        user.role,
        clientIp,
        userAgent
      );
      res.status(201).json({ status: 'success', data: room });
    } catch (err) {
      next(err);
    }
  }

  async updateRoom(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const clientIp = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const { roomId } = req.params;

      const updated = await hostelService.updateRoom(
        roomId,
        req.body,
        user.userId,
        user.role,
        clientIp,
        userAgent
      );
      res.status(200).json({ status: 'success', data: updated });
    } catch (err) {
      next(err);
    }
  }

  async getRoomMatrix(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const matrix = await hostelService.getRoomMatrix();
      res.status(200).json({ status: 'success', data: matrix });
    } catch (err) {
      next(err);
    }
  }
}

export const hostelController = new HostelController();
