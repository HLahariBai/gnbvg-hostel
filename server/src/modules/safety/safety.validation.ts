import { z } from 'zod';

export const createTicketSchema = z.object({
  body: z.object({
    category: z.enum([
      'LOCK_SECURITY',
      'CCTV_FAULT',
      'CORRIDOR_LIGHTING',
      'UNAUTHORIZED_VISITOR',
      'HARASSMENT_RAGGING',
      'MAINTENANCE_OTHER',
    ]),
    title: z.string().min(3, 'Title is required'),
    description: z.string().min(10, 'Detailed description is required'),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
    isAnonymous: z.boolean().default(false),
  }),
});

export const updateTicketSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Ticket ID is required'),
  }),
  body: z.object({
    status: z.enum(['REPORTED', 'UNDER_REVIEW', 'IN_PROGRESS', 'RESOLVED']),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    assignedToId: z.string().optional(),
    resolutionSummary: z.string().optional(),
  }),
});
