import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load environment variables from .env (both current working directory and server/.env fallback)
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), 'server', '.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  TIMEZONE: z.string().default('Asia/Kolkata'),

  // PostgreSQL Connections
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is strictly required'),
  DIRECT_URL: z.string().optional(),

  // Redis Cache
  REDIS_URL: z.string().min(1, 'REDIS_URL is strictly required'),

  // JWT Secrets (Strict minimum 32-character requirement for cryptographic resilience)
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters long'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters long'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  // AES-256-GCM 256-bit Key (Requires exactly 64 hex characters = 32 bytes)
  AES_256_GCM_ENCRYPTION_KEY: z
    .string()
    .length(64, 'AES_256_GCM_ENCRYPTION_KEY must be a 64-character hexadecimal string (32 bytes)')
    .regex(/^[0-9a-fA-F]+$/, 'AES_256_GCM_ENCRYPTION_KEY must be hexadecimal'),

  // HMAC & Digital Signatures
  HMAC_SECRET: z.string().min(32, 'HMAC_SECRET must be at least 32 characters long'),
  QR_SIGNING_SECRET: z.string().min(32, 'QR_SIGNING_SECRET must be at least 32 characters long'),

  // SMTP Settings for Dual-Channel OTP
  SMTP_HOST: z.string().min(1, 'SMTP_HOST is required for institutional email delivery'),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().min(1, 'SMTP_USER is required'),
  SMTP_PASS: z.string().min(1, 'SMTP_PASS is required'),
  SMTP_FROM: z.string().min(1, 'SMTP_FROM is required'),

  // TOTP Configuration
  TOTP_SERVICE_NAME: z.string().default('GPREC-GNBVG-Hostel'),

  // Geofence & GPS Quality Controls
  HOSTEL_LATITUDE: z.coerce.number().min(-90).max(90).default(15.8344),
  HOSTEL_LONGITUDE: z.coerce.number().min(-180).max(180).default(78.0373),
  GEOFENCE_RADIUS_METERS: z.coerce.number().positive().default(200),
  MAX_GPS_ACCURACY_METERS: z.coerce.number().positive().default(50),
  MAX_GPS_AGE_SECONDS: z.coerce.number().positive().default(60),

  // Attendance Timing Defaults
  DEFAULT_ATTENDANCE_START: z.string().regex(/^\d{2}:\d{2}$/, 'Format must be HH:MM').default('17:00'),
  DEFAULT_ATTENDANCE_END: z.string().regex(/^\d{2}:\d{2}$/, 'Format must be HH:MM').default('19:00'),
  DEFAULT_REMINDER_INTERVAL_MIN: z.coerce.number().int().positive().default(15),

  // CORS Configuration
  CORS_ALLOWED_ORIGINS: z
    .string()
    .default('http://localhost:5173,http://localhost:3000')
    .transform((val) => val.split(',').map((origin) => origin.trim()).filter(Boolean)),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validates process.env against the strict environment schema.
 * If any secret or mandatory configuration is missing or malformed,
 * logs a critical security alert and immediately crashes the process with exit code 1.
 */
export function validateEnv(): EnvConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errorDetails = result.error.errors.map((err) => {
      const field = err.path.join('.');
      return `  - [${field}]: ${err.message}`;
    });

    console.error('\n' + '='.repeat(80));
    console.error('FATAL SYSTEM CONFIGURATION ERROR - STARTUP ABORTED');
    console.error('='.repeat(80));
    console.error('The following critical environment variables failed validation:');
    console.error(errorDetails.join('\n'));
    console.error('='.repeat(80));
    console.error('Ensure all required secrets are provided in .env before restarting.\n');

    process.exit(1);
  }

  return result.data;
}

export const env: EnvConfig = validateEnv();
