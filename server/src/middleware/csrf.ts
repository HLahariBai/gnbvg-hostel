import type { Request, Response, NextFunction } from 'express';
import { verifyCsrfToken, generateCsrfToken } from '../utils/crypto.js';

export const CSRF_COOKIE_NAME = '_csrf';
export const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Middleware that sets a fresh anti-CSRF token cookie if one is not present.
 */
export function ensureCsrfCookie(req: Request, res: Response, next: NextFunction): void {
  const existingCookie = req.cookies?.[CSRF_COOKIE_NAME];
  if (!existingCookie) {
    const token = generateCsrfToken();
    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false, // Must be readable by client JS to send in X-CSRF-Token header
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/',
    });
  }
  next();
}

/**
 * Validates the CSRF token on state-changing HTTP requests (POST, PUT, PATCH, DELETE).
 * Enforces Double Submit Cookie cryptographic verification.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Paths exempt from CSRF (e.g. health checks or webhooks)
  const exemptPaths = ['/api/health', '/api/db-health'];
  if (exemptPaths.includes(req.path)) {
    return next();
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.headers[CSRF_HEADER_NAME] as string | undefined;

  if (!verifyCsrfToken(cookieToken, headerToken)) {
    res.status(403).json({
      status: 'error',
      errorCode: 'CSRF_VALIDATION_FAILED',
      message: 'Access Denied: Missing or invalid anti-CSRF token.',
    });
    return;
  }

  next();
}
