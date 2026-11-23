import { z } from 'zod';

export const applyLeaveSchema = z.object({
  body: z
    .object({
      leaveType: z.enum(['HOME_VISIT', 'MEDICAL', 'ACADEMIC', 'EMERGENCY', 'OTHER']).default('HOME_VISIT'),
      reasonCategory: z.string().min(2, 'Reason category is required'),
      reasonDetails: z.string().min(5, 'Reason details are required'),
      fromDate: z.string().datetime({ message: 'fromDate must be a valid ISO datetime' }),
      toDate: z.string().datetime({ message: 'toDate must be a valid ISO datetime' }),
      expectedReturnDate: z.string().datetime({ message: 'expectedReturnDate must be a valid ISO datetime' }),
      parentConsentVerified: z.boolean().default(false),
      parentConsentMethod: z.enum(['SMS_OTP', 'PHONE_CALL', 'PORTAL_CONFIRM']).optional(),
    })
    .refine((data) => new Date(data.toDate) >= new Date(data.fromDate), {
      message: 'toDate must be on or after fromDate',
      path: ['toDate'],
    }),
});

export const reviewLeaveSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Leave ID is required'),
  }),
  body: z.object({
    status: z.enum(['APPROVED', 'REJECTED', 'CANCELLED']),
    decisionRemarks: z.string().optional(),
  }),
});
