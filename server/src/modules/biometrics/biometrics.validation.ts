import { z } from 'zod';

export const enrollFaceSchema = z.object({
  body: z.object({
    studentId: z.string().min(1, 'Student ID is required').optional(), // If omitted, current authenticated student is used
    templateData: z.string().min(10, 'Face embedding template vector data is required'),
    qualityScore: z.number().min(0).max(1, 'Quality score must be between 0.0 and 1.0'),
    modelVersion: z.string().default('Facenet512-v1').optional(),
  }),
});

export const reviewEnrollmentSchema = z.object({
  params: z.object({
    enrollmentId: z.string().min(1, 'Enrollment ID is required'),
  }),
  body: z.object({
    status: z.enum(['ACTIVE', 'PENDING_REVIEW', 'REVOKED']),
    notes: z.string().optional(),
  }),
});

export const verifyPhotoMetadataSchema = z.object({
  body: z.object({
    studentId: z.string().min(1, 'Student ID is required').optional(),
    width: z.number().int().min(240, 'Minimum width is 240px'),
    height: z.number().int().min(240, 'Minimum height is 240px'),
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']).default('image/jpeg'),
    captureTimestamp: z.string().datetime({ message: 'Must be valid ISO timestamp' }),
    brightness: z.number().min(0).max(255).default(128),
    sharpness: z.number().min(0).max(100).default(80),
    faceDetected: z.boolean().default(true),
    boundingBox: z
      .object({
        x: z.number().min(0),
        y: z.number().min(0),
        width: z.number().positive(),
        height: z.number().positive(),
      })
      .optional(),
    livenessScore: z.number().min(0).max(1, 'Liveness score must be between 0.0 and 1.0'),
    faceMatchConfidence: z.number().min(0).max(1, 'Face match confidence must be between 0.0 and 1.0'),
  }),
});
