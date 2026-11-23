import { z } from 'zod';
import { GPREC_EMAIL_REGEX } from '../auth/auth.validation.js';

export const triageIntrusionSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Intrusion ID is required'),
  }),
  body: z.object({
    status: z.enum(['ACKNOWLEDGED', 'FLAGGED_TO_PRINCIPAL', 'WHITELISTED']),
    reviewNotes: z.string().min(3, 'Review notes are required'),
    whitelistData: z
      .object({
        studentName: z.string().min(2),
        blockCode: z.enum(['A', 'B', 'C']),
        roomNumber: z.string().min(1),
        academicYear: z.number().int().min(1).max(4),
        branch: z.string().min(2),
        section: z.string().min(1),
      })
      .optional(),
  }),
});

export const addSingleRegistrySchema = z.object({
  body: z.object({
    registrationNumber: z.string().min(4).transform((v) => v.trim().toUpperCase()),
    collegeEmail: z
      .string()
      .email()
      .regex(GPREC_EMAIL_REGEX, 'Email must be an official @gprec.ac.in address')
      .transform((v) => v.trim().toLowerCase()),
    studentName: z.string().min(2),
    blockCode: z.enum(['A', 'B', 'C']),
    roomNumber: z.string().min(1),
    academicYear: z.number().int().min(1).max(4),
    branch: z.string().min(2),
    section: z.string().min(1),
  }),
});

export const bulkRegistrySchema = z.object({
  body: z.object({
    records: z
      .array(
        z.object({
          registrationNumber: z.string().min(4).transform((v) => v.trim().toUpperCase()),
          collegeEmail: z
            .string()
            .email()
            .regex(GPREC_EMAIL_REGEX)
            .transform((v) => v.trim().toLowerCase()),
          studentName: z.string().min(2),
          blockCode: z.enum(['A', 'B', 'C']),
          roomNumber: z.string().min(1),
          academicYear: z.number().int().min(1).max(4),
          branch: z.string().min(2),
          section: z.string().min(1),
        })
      )
      .min(1, 'At least 1 student record is required')
      .max(1500, 'Maximum 1,500 records per bulk batch'),
  }),
});
