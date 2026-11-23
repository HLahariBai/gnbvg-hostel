import type { Request, Response, NextFunction } from 'express';
import jsonwebtoken from 'jsonwebtoken';
import { env } from '../config/env.js';
import { db } from '../db/sqlite.js';

export interface SqliteUserRecord {
  id: string;
  name: string;
  roll_number: string | null;
  email: string;
  role: 'student' | 'warden' | 'admin';
  year: '1' | '2' | '3' | '4' | null;
  block: 'Anapurna-A' | 'Arundhathi-B' | 'Anuradha-C' | null;
  room_number: string | null;
  branch?: string | null;
  student_phone?: string | null;
  father_phone?: string | null;
  mother_phone?: string | null;
  hostel_id?: string | null;
  is_activated?: number; // 0 or 1
  face_enrolled: number; // 0 or 1
  created_at: string;
}

export interface AuthenticatedSqliteRequest extends Request {
  sqliteUser?: SqliteUserRecord;
}

export function authenticateSqlite(
  req: AuthenticatedSqliteRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (req.cookies?.access_token) {
      token = req.cookies.access_token;
    } else if (req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Authentication required. Missing Bearer token or cookie.',
      });
      return;
    }

    const decoded = jsonwebtoken.verify(token, env.JWT_ACCESS_SECRET) as {
      id: string;
      email: string;
      role: 'student' | 'warden' | 'admin';
    };

    const stmt = db.prepare(`
      SELECT id, name, roll_number, email, role, year, block, room_number, face_enrolled, created_at
      FROM users
      WHERE id = ?
    `);

    const user = stmt.get(decoded.id) as SqliteUserRecord | undefined;

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Invalid session: User record no longer exists in database.',
      });
      return;
    }

    req.sqliteUser = user;
    next();
  } catch (err) {
    res.status(401).json({
      success: false,
      error: 'Invalid or expired authentication token',
      details: err instanceof Error ? err.message : undefined,
    });
  }
}

export function requireRole(...allowedRoles: Array<'student' | 'warden' | 'admin'>) {
  return (req: AuthenticatedSqliteRequest, res: Response, next: NextFunction): void => {
    if (!req.sqliteUser) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    if (!allowedRoles.includes(req.sqliteUser.role)) {
      res.status(403).json({
        success: false,
        error: `Access forbidden: Requires role [${allowedRoles.join(', ')}]. Current role: ${req.sqliteUser.role}`,
      });
      return;
    }

    next();
  };
}
