/**
 * System-wide constants for GNBVG Hostel Safety, Attendance & Movement System
 */

export const INSTITUTION = {
  NAME: 'G. Pulla Reddy Engineering College (Autonomous)',
  SHORT_NAME: 'GPREC',
  LOCATION: 'Kurnool, Andhra Pradesh, India',
  OFFICIAL_EMAIL_DOMAIN: '@gprec.ac.in',
} as const;

export const HOSTEL = {
  CODE: 'GNBVG',
  NAME: 'G. Narayanamma Balikala Vasathi Gruham',
  TYPE: 'Girls Hostel',
  BLOCKS: {
    A: { CODE: 'A', NAME: 'Arundhathi' },
    B: { CODE: 'B', NAME: 'Annapurna' },
    C: { CODE: 'C', NAME: 'Anuradha' },
  },
  COORDINATES: {
    LATITUDE: 15.8344,
    LONGITUDE: 78.0373,
    DEFAULT_RADIUS_METERS: 200,
  },
  TIMEZONE: 'Asia/Kolkata',
} as const;

export const ATTENDANCE_CONSTRAINTS = {
  DEFAULT_START_TIME: '17:00',
  DEFAULT_END_TIME: '19:00',
  REMINDER_INTERVAL_MINUTES: 15,
  MAX_GPS_ACCURACY_METERS: 50,
  MAX_GPS_AGE_SECONDS: 60,
  FACE_CONFIDENCE_THRESHOLD: 0.85,
  LIVENESS_CONFIDENCE_THRESHOLD: 0.9,
} as const;

export const SECURITY_POLICIES = {
  OTP_LENGTH: 6,
  OTP_EXPIRY_MINUTES: 5,
  OTP_RESEND_COOLDOWN_SECONDS: 60,
  MAX_OTP_ATTEMPTS: 5,
  PASSWORD_MIN_LENGTH: 8,
  SOS_COUNTDOWN_SECONDS: 3,
} as const;
