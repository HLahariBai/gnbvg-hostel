import { Router } from 'express';
import { safetyController } from './safety.controller.js';
import { createTicketSchema, updateTicketSchema } from './safety.validation.js';
import { validateRequest } from '../../middleware/validate.js';
import {
  authenticate,
  requireStudent,
  requireWardenOrAdmin,
} from '../../middleware/auth.js';
import { csrfProtection } from '../../middleware/csrf.js';

const router = Router();

// Student file safety / maintenance incident ticket (supports anonymous reporting)
router.post(
  '/tickets',
  authenticate,
  requireStudent,
  csrfProtection,
  validateRequest(createTicketSchema),
  safetyController.createTicket
);

// Student view own non-anonymous tickets
router.get(
  '/my-tickets',
  authenticate,
  requireStudent,
  safetyController.getMyTickets
);

// Warden view all safety & maintenance tickets
router.get(
  '/tickets',
  authenticate,
  requireWardenOrAdmin,
  safetyController.getAllTickets
);

// Warden update ticket triage status & resolution
router.patch(
  '/tickets/:id',
  authenticate,
  requireWardenOrAdmin,
  csrfProtection,
  validateRequest(updateTicketSchema),
  safetyController.updateTicketStatus
);

export default router;
