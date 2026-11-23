import { z } from 'zod';
import { INSTITUTION } from '../../constants/index.js';

// Regex for official GPREC email domain enforcement
export const GPREC_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@gprec\.ac\.in$/;

// Strong password policy: Min 8 chars, uppercase, lowercase, number, special character
export const STRONG_PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

// 10-digit mobile phone regex
export const PHONE_REGEX = /^[6-9]\d{9}$/;

// Optional phone schema that validates 10-digit Indian mobile format when provided
export const optionalPhoneSchema = z
  .string()
  .trim()
  .refine((val) => !val || PHONE_REGEX.test(val), {
    message: 'Mobile number must be a valid 10-digit Indian number starting with 6, 7, 8, or 9',
  })
  .optional()
  .or(z.literal(''));

export const initiateRegistrationSchema = z.object({
  body: z
    .object({
      fullName: z.string().min(2, 'Full Name is required'),
      registrationNumber: z
        .string()
        .min(4, 'Registration number is required')
        .transform((val) => val.trim().toUpperCase()),
      collegeEmail: z
        .string()
        .email('Invalid email address')
        .regex(GPREC_EMAIL_REGEX, `Email must be an official GPREC address ending with ${INSTITUTION.OFFICIAL_EMAIL_DOMAIN}`),
      password: z
        .string()
        .min(8, 'Password must be at least 8 characters long')
        .regex(
          STRONG_PASSWORD_REGEX,
          'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
        ),
      academicYear: z.coerce.number().int().min(1).max(4, 'Academic Year must be between 1 and 4'),
      branch: z.enum(['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'CSM', 'CSD'], {
        errorMap: () => ({ message: 'Branch must be one of: CSE, ECE, EEE, MECH, CIVIL, CSM, CSD' }),
      }),
      section: z.enum(['A', 'B', 'C', 'D'], {
        errorMap: () => ({ message: 'Section must be one of: A, B, C, D' }),
      }),
      primaryPhone: z
        .string()
        .regex(PHONE_REGEX, 'Primary Phone must be a valid 10-digit Indian mobile number'),
      secondaryPhone: z
        .string()
        .regex(PHONE_REGEX, 'Secondary Phone must be a valid 10-digit mobile number')
        .optional()
        .or(z.literal('')),
      permanentAddress: z.string().min(5, 'Permanent Home Address is required'),
      blockCode: z.enum(['A', 'B', 'C'], {
        errorMap: () => ({ message: 'Hostel Block must be Block A, Block B, or Block C' }),
      }),
      roomNumber: z.string().min(1, 'Room Number is required'),

      // Parent / Guardian Information
      fatherName: z.string().optional().or(z.literal('')),
      fatherPhone: optionalPhoneSchema,
      motherName: z.string().optional().or(z.literal('')),
      motherPhone: optionalPhoneSchema,
      guardianName: z.string().optional().or(z.literal('')),
      guardianRelation: z.string().optional().or(z.literal('')),
      guardianPhone: optionalPhoneSchema,
    })
    .refine(
      (data) => {
        const hasFather = Boolean(data.fatherName?.trim() && data.fatherPhone?.trim());
        const hasMother = Boolean(data.motherName?.trim() && data.motherPhone?.trim());

        // If either father or mother is provided, guardian is optional
        if (hasFather || hasMother) {
          return true;
        }

        // If both father and mother are omitted, guardian details are strictly mandatory
        const hasGuardian = Boolean(
          data.guardianName?.trim() &&
            data.guardianRelation?.trim() &&
            data.guardianPhone?.trim() &&
            PHONE_REGEX.test(data.guardianPhone.trim())
        );

        return hasGuardian;
      },
      {
        message:
          'Guardian Name, Relationship, and a valid 10-digit Guardian Phone are mandatory when both Father and Mother details are omitted.',
        path: ['guardianName'],
      }
    ),
});

export const verifyRegistrationOtpSchema = z.object({
  body: z.object({
    collegeEmail: z.string().email().regex(GPREC_EMAIL_REGEX),
    otp: z.string().length(6, 'OTP must be exactly 6 digits').regex(/^\d{6}$/, 'OTP must be numeric'),
  }),
});

export const resendOtpSchema = z.object({
  body: z.object({
    collegeEmail: z.string().email().regex(GPREC_EMAIL_REGEX),
    purpose: z.enum(['REGISTRATION', 'PASSWORD_RESET', 'LOGIN_MFA']).default('REGISTRATION'),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const verifyMfaLoginSchema = z.object({
  body: z.object({
    tempToken: z.string().min(1, 'Temporary MFA verification token is required'),
    totpCode: z.string().length(6, 'TOTP code must be 6 digits').regex(/^\d{6}$/, 'TOTP must be numeric'),
  }),
});

export const enableMfaSchema = z.object({
  body: z.object({
    totpCode: z.string().length(6, 'TOTP code must be 6 digits').regex(/^\d{6}$/, 'TOTP must be numeric'),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    identifier: z.string().min(3, 'Email or Phone Number is required'),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    email: z.string().email(),
    otp: z.string().length(6).regex(/^\d{6}$/),
    newPassword: z.string().min(8).regex(STRONG_PASSWORD_REGEX, 'Password does not meet complexity requirements'),
  }),
});
