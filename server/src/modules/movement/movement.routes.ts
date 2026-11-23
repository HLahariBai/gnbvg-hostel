import { Router } from 'express';
import { movementController } from './movement.controller.js';
import {
  applyGatePassSchema,
  reviewGatePassSchema,
  gateMovementSchema,
  verifyQrSchema,
} from './movement.validation.js';
import { validateRequest } from '../../middleware/validate.js';
import {
  authenticate,
  requireStudent,
  requireWardenOrAdmin,
} from '../../middleware/auth.js';
import { csrfProtection } from '../../middleware/csrf.js';

const router = Router();

// Student apply for Day Pass or Night Out Pass
router.post(
  '/apply',
  authenticate,
  requireStudent,
  csrfProtection,
  validateRequest(applyGatePassSchema),
  movementController.applyPass
);

// Student view own pass history
router.get(
  '/my-passes',
  authenticate,
  requireStudent,
  movementController.getMyPasses
);

// Warden view pending pass queue
router.get(
  '/pending',
  authenticate,
  requireWardenOrAdmin,
  movementController.getPendingPasses
);

// Warden approve or reject pass
router.patch(
  '/:id/review',
  authenticate,
  requireWardenOrAdmin,
  csrfProtection,
  validateRequest(reviewGatePassSchema),
  movementController.reviewPass
);

// Gate security verify digital HMAC QR code
router.post(
  '/verify-qr',
  authenticate,
  validateRequest(verifyQrSchema),
  movementController.verifyQr
);

// Gate check-out departure
router.post(
  '/:id/check-out',
  authenticate,
  requireWardenOrAdmin,
  csrfProtection,
  validateRequest(gateMovementSchema),
  movementController.checkOut
);

// Gate check-in return
router.post(
  '/:id/check-in',
  authenticate,
  requireWardenOrAdmin,
  csrfProtection,
  validateRequest(gateMovementSchema),
  movementController.checkIn
);

// Warden view overdue students
router.get(
  '/overdue',
  authenticate,
  requireWardenOrAdmin,
  movementController.getOverduePasses
);

export default router;
