import { Router } from 'express';
import { sosController } from './sos.controller.js';
import { triggerSosSchema, resolveSosSchema } from './sos.validation.js';
import { validateRequest } from '../../middleware/validate.js';
import {
  authenticate,
  requireStudent,
  requireWardenOrAdmin,
} from '../../middleware/auth.js';
import { csrfProtection } from '../../middleware/csrf.js';

const router = Router();

// Student trigger emergency SOS (accessible from any screen via sticky button)
router.post(
  '/trigger',
  authenticate,
  requireStudent,
  csrfProtection,
  validateRequest(triggerSosSchema),
  sosController.trigger
);

// Warden / Admin get active emergency alerts
router.get(
  '/active',
  authenticate,
  requireWardenOrAdmin,
  sosController.getActive
);

// Warden acknowledge SOS alert
router.patch(
  '/:id/acknowledge',
  authenticate,
  requireWardenOrAdmin,
  csrfProtection,
  sosController.acknowledge
);

// Warden resolve SOS alert
router.patch(
  '/:id/resolve',
  authenticate,
  requireWardenOrAdmin,
  csrfProtection,
  validateRequest(resolveSosSchema),
  sosController.resolve
);

// Historical alerts list
router.get(
  '/history',
  authenticate,
  requireWardenOrAdmin,
  sosController.getHistory
);

export default router;
