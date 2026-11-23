import { Router } from 'express';
import { leaveController } from './leave.controller.js';
import { applyLeaveSchema, reviewLeaveSchema } from './leave.validation.js';
import { validateRequest } from '../../middleware/validate.js';
import {
  authenticate,
  requireStudent,
  requireWardenOrAdmin,
} from '../../middleware/auth.js';
import { csrfProtection } from '../../middleware/csrf.js';

const router = Router();

// Student apply for leave
router.post(
  '/apply',
  authenticate,
  requireStudent,
  csrfProtection,
  validateRequest(applyLeaveSchema),
  leaveController.applyLeave
);

// Student view own leave applications
router.get(
  '/my-leaves',
  authenticate,
  requireStudent,
  leaveController.getMyLeaves
);

// Warden view leave applications
router.get(
  '/',
  authenticate,
  requireWardenOrAdmin,
  leaveController.getAllLeaves
);

// Warden approve/reject leave
router.patch(
  '/:id/review',
  authenticate,
  requireWardenOrAdmin,
  csrfProtection,
  validateRequest(reviewLeaveSchema),
  leaveController.reviewLeave
);

export default router;
