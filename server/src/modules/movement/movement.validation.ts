import { z } from 'zod';

export const applyGatePassSchema = z.object({
  body: z
    .object({
      passType: z.enum(['DAY_PASS', 'NIGHT_OUT_PASS']).default('DAY_PASS'),
      destination: z.string().min(2, 'Destination is required'),
      reason: z.string().min(3, 'Reason for gate pass is required'),
      validFrom: z.string().datetime({ message: 'validFrom must be a valid ISO datetime' }),
      validUntil: z.string().datetime({ message: 'validUntil must be a valid ISO datetime' }),
      parentConfirmed: z.boolean().default(false),
    })
    .refine((data) => new Date(data.validUntil) > new Date(data.validFrom), {
      message: 'validUntil must be after validFrom datetime',
      path: ['validUntil'],
    }),
});

export const reviewGatePassSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Gate pass ID is required'),
  }),
  body: z.object({
    decision: z.enum(['APPROVE', 'REJECT']),
    remarks: z.string().optional(),
  }),
});

export const gateMovementSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Gate pass ID is required'),
  }),
  body: z.object({
    checkpointLocation: z.string().default('MAIN_HOSTEL_GATE'),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    remarks: z.string().optional(),
  }),
});

export const verifyQrSchema = z.object({
  body: z.object({
    qrData: z.string().min(10, 'QR payload string is required'),
  }),
});
