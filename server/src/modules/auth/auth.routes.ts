import { Router } from 'express';
import { authController } from './auth.controller.js';
import { validateRequest } from '../../middleware/validate.js';
import { authRateLimiter, otpRateLimiter } from '../../middleware/rateLimiter.js';
import { authenticate } from '../../middleware/auth.js';
import {
  initiateRegistrationSchema,
  verifyRegistrationOtpSchema,
  resendOtpSchema,
  loginSchema,
  verifyMfaLoginSchema,
  enableMfaSchema,
} from './auth.validation.js';

const router = Router();

// CSRF Token Generation
router.get('/csrf-token', authController.getCsrfToken);

// Registration Gatekeeper & OTP Flow
router.post(
  '/register/initiate',
  authRateLimiter,
  validateRequest(initiateRegistrationSchema),
  authController.initiateRegistration
);

router.post(
  '/register/verify',
  authRateLimiter,
  validateRequest(verifyRegistrationOtpSchema),
  authController.verifyRegistration
);

router.post(
  '/otp/resend',
  otpRateLimiter,
  validateRequest(resendOtpSchema),
  authController.resendOtp
);

// Login & MFA
router.post(
  '/login',
  authRateLimiter,
  validateRequest(loginSchema),
  authController.login
);

router.post(
  '/mfa/verify-login',
  authRateLimiter,
  validateRequest(verifyMfaLoginSchema),
  authController.verifyMfaLogin
);

// Authenticated MFA Management
router.post('/mfa/setup', authenticate, authController.setupMfa);
router.post('/mfa/enable', authenticate, validateRequest(enableMfaSchema), authController.enableMfa);

// Session Lifecycle
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.getMe);

export default router;
