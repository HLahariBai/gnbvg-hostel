import { z } from 'zod';
import { PHONE_REGEX } from '../auth/auth.validation.js';

export const logVisitorSchema = z.object({
  body: z.object({
    visitorName: z.string().min(2, 'Visitor name is required'),
    idProofType: z.enum(['AADHAAR', 'PAN', 'VOTER_ID', 'COLLEGE_ID', 'DRIVING_LICENSE']),
    idProofNumber: z.string().min(4, 'ID proof number is required'),
    studentId: z.string().min(1, 'Student ID being visited is required'),
    purpose: z.string().min(3, 'Purpose of visit is required'),
    contactPhone: z.string().regex(PHONE_REGEX, 'Contact phone must be a valid 10-digit mobile number'),
  }),
});

export const createAnnouncementSchema = z.object({
  body: z.object({
    title: z.string().min(3, 'Announcement title is required'),
    content: z.string().min(5, 'Announcement content is required'),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
    targetBlockCodes: z.string().default('ALL'),
    validUntil: z.string().datetime({ message: 'validUntil must be a valid ISO datetime' }),
  }),
});
