import { Router } from 'express';
import { biometricsController } from './biometrics.controller.js';
import {
  enrollFaceSchema,
  reviewEnrollmentSchema,
  verifyPhotoMetadataSchema,
} from './biometrics.validation.js';
import { validateRequest } from '../../middleware/validate.js';
import {
  authenticate,
  requireWardenOrAdmin,
} from '../../middleware/auth.js';
import { csrfProtection } from '../../middleware/csrf.js';

const router = Router();

// Biometric enrollment (Student self-enrollment or Warden assisted)
router.post(
  '/enroll',
  authenticate,
  csrfProtection,
  validateRequest(enrollFaceSchema),
  biometricsController.enrollFace
);

// Get enrollment status (Self or specific student)
router.get(
  '/status/:studentId?',
  authenticate,
  biometricsController.getEnrollmentStatus
);

// Review enrollment status (Warden/Admin)
router.patch(
  '/review/:enrollmentId',
  authenticate,
  requireWardenOrAdmin,
  csrfProtection,
  validateRequest(reviewEnrollmentSchema),
  biometricsController.reviewEnrollment
);

// Test/Evaluate interactive photo metadata & liveness thresholds
router.post(
  '/verify-photo',
  authenticate,
  validateRequest(verifyPhotoMetadataSchema),
  biometricsController.verifyPhotoMetadata
);

export default router;
