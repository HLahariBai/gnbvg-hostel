import { z } from 'zod';

export const checkInAttendanceSchema = z.object({
  body: z.object({
    latitude: z.number().min(-90).max(90, 'Invalid latitude'),
    longitude: z.number().min(-180).max(180, 'Invalid longitude'),
    accuracyMeters: z.number().min(0).max(500, 'Accuracy must be realistic'),
    captureTimestamp: z.string().datetime({ message: 'Must be valid ISO timestamp' }),
    faceConfidence: z.number().min(0).max(1).default(0.95),
    livenessConfidence: z.number().min(0).max(1).default(0.96),
    photoMetadata: z
      .object({
        width: z.number().int().min(240).optional(),
        height: z.number().int().min(240).optional(),
        brightness: z.number().optional(),
        sharpness: z.number().optional(),
      })
      .optional(),
  }),
});

export const manualOverrideSchema = z.object({
  body: z.object({
    studentId: z.string().min(1, 'Student ID is required'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD'),
    status: z.enum(['PRESENT', 'PENDING_REVIEW', 'REJECTED', 'NOT_GIVEN']),
    remarks: z.string().min(5, 'Mandatory remarks explaining the supervisor manual override reason.'),
  }),
});

export const getDailyReportSchema = z.object({
  query: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD').optional(),
    blockId: z.string().optional(),
    status: z.enum(['PRESENT', 'PENDING_REVIEW', 'REJECTED', 'DUPLICATE', 'NOT_GIVEN']).optional(),
    page: z.coerce.number().int().min(1).default(1).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50).optional(),
  }),
});
