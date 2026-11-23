import { z } from 'zod';

export const triggerSosSchema = z.object({
  body: z.object({
    triggerType: z.enum(['INSTANT', 'COUNTDOWN_AUTO']).default('INSTANT'),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  }),
});

export const resolveSosSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'SOS Alert ID is required'),
  }),
  body: z.object({
    status: z.enum(['RESOLVED', 'FALSE_ALARM']),
    resolutionNotes: z.string().min(5, 'Mandatory resolution notes detailing the incident response.'),
  }),
});
