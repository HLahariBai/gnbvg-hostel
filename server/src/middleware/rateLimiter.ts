import rateLimit from 'express-rate-limit';

/**
 * Strict rate limiter for authentication endpoints (Login, Registration)
 * Mitigates brute-force credential stuffing and password guessing.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Limit each IP to 15 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    errorCode: 'TOO_MANY_REQUESTS',
    message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.',
  },
});

/**
 * High-sensitivity rate limiter for OTP creation, resend, and verification
 * Mitigates SMS/Email flooding and OTP brute-force attacks.
 */
export const otpRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 6, // Limit each IP to 6 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    errorCode: 'TOO_MANY_REQUESTS',
    message: 'Too many OTP requests. Please wait before requesting another verification code.',
  },
});

/**
 * General API rate limiter for standard endpoints.
 */
export const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // 300 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    errorCode: 'TOO_MANY_REQUESTS',
    message: 'Too many requests from this client. Please slow down.',
  },
});
