import type { Request, Response, NextFunction } from 'express';
import type { CookieOptions } from 'express';
import { authService } from './auth.service.js';
import { env } from '../../config/env.js';
import { generateCsrfToken } from '../../utils/crypto.js';
import { CSRF_COOKIE_NAME } from '../../middleware/csrf.js';

const isProduction = env.NODE_ENV === 'production';

export const ACCESS_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'strict',
  maxAge: 15 * 60 * 1000, // 15 mins
  path: '/',
};

export const REFRESH_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
};

export const CSRF_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: false, // Read by client JS to send in X-CSRF-Token header
  secure: isProduction,
  sameSite: 'strict',
  maxAge: 24 * 60 * 60 * 1000,
  path: '/',
};

export class AuthController {
  /**
   * GET /api/auth/csrf-token
   * Generates and returns an anti-CSRF token and sets the cookie
   */
  async getCsrfToken(_req: Request, res: Response): Promise<void> {
    const token = generateCsrfToken();
    res.cookie(CSRF_COOKIE_NAME, token, CSRF_COOKIE_OPTIONS);
    res.status(200).json({
      status: 'success',
      csrfToken: token,
    });
  }

  /**
   * POST /api/auth/register/initiate
   * Validates GPREC email and registry whitelist; issues dual-channel OTP
   */
  async initiateRegistration(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientIp = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const result = await authService.initiateRegistration(req.body, clientIp, userAgent);
      res.status(200).json({
        status: 'success',
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/register/verify
   * Verifies OTP, persists student profile, and issues authenticated cookies
   */
  async verifyRegistration(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientIp = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const { collegeEmail, otp } = req.body;

      const result = await authService.verifyRegistrationOtp(collegeEmail, otp, clientIp, userAgent);

      // Set Secure, HttpOnly, SameSite=Strict cookies
      res.cookie('accessToken', result.accessToken, ACCESS_COOKIE_OPTIONS);
      res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);

      // Issue anti-CSRF token
      const csrfToken = generateCsrfToken();
      res.cookie(CSRF_COOKIE_NAME, csrfToken, CSRF_COOKIE_OPTIONS);

      res.status(201).json({
        status: 'success',
        message: result.message,
        user: result.user,
        csrfToken,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/otp/resend
   */
  async resendOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { collegeEmail, purpose } = req.body;
      const result = await authService.resendOtp(collegeEmail, purpose);
      res.status(200).json({
        status: 'success',
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/login
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientIp = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const { email, password } = req.body;

      const result = await authService.login(email, password, clientIp, userAgent);

      if (result.mfaRequired) {
        res.status(200).json({
          status: 'mfa_required',
          mfaRequired: true,
          tempToken: result.tempToken,
          message: result.message,
        });
        return;
      }

      // Set Auth Cookies (result is narrowed to LoginResult with mfaRequired: false)
      res.cookie('accessToken', result.accessToken, ACCESS_COOKIE_OPTIONS);
      res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);

      // Issue anti-CSRF token
      const csrfToken = generateCsrfToken();
      res.cookie(CSRF_COOKIE_NAME, csrfToken, CSRF_COOKIE_OPTIONS);

      res.status(200).json({
        status: 'success',
        mfaRequired: false,
        user: result.user,
        csrfToken,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/mfa/verify-login
   */
  async verifyMfaLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientIp = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const { tempToken, totpCode } = req.body;

      const result = await authService.verifyMfaLogin(tempToken, totpCode, clientIp, userAgent);

      res.cookie('accessToken', result.accessToken, ACCESS_COOKIE_OPTIONS);
      res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);

      const csrfToken = generateCsrfToken();
      res.cookie(CSRF_COOKIE_NAME, csrfToken, CSRF_COOKIE_OPTIONS);

      res.status(200).json({
        status: 'success',
        user: result.user,
        csrfToken,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/mfa/setup (Requires authentication)
   */
  async setupMfa(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const result = await authService.setupMfa(userId);
      res.status(200).json({
        status: 'success',
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/mfa/enable (Requires authentication)
   */
  async enableMfa(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { totpCode } = req.body;
      const result = await authService.enableMfa(userId, totpCode);
      res.status(200).json({
        status: 'success',
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/refresh
   */
  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
      const clientIp = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await authService.refreshAccessToken(refreshToken, clientIp, userAgent);

      res.cookie('accessToken', result.accessToken, ACCESS_COOKIE_OPTIONS);
      res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);

      const csrfToken = generateCsrfToken();
      res.cookie(CSRF_COOKIE_NAME, csrfToken, CSRF_COOKIE_OPTIONS);

      res.status(200).json({
        status: 'success',
        expiresIn: result.expiresIn,
        csrfToken,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/logout
   */
  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies?.refreshToken;
      const userId = req.user?.userId;

      await authService.logout(refreshToken, userId);

      res.clearCookie('accessToken', { path: '/' });
      res.clearCookie('refreshToken', { path: '/' });
      res.clearCookie(CSRF_COOKIE_NAME, { path: '/' });

      res.status(200).json({
        status: 'success',
        message: 'Logged out successfully.',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/auth/me
   */
  async getMe(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      status: 'success',
      user: req.user,
    });
  }
}

export const authController = new AuthController();
