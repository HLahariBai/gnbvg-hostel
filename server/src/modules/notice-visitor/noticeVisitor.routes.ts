import { Router } from 'express';
import { noticeVisitorController } from './noticeVisitor.controller.js';
import { logVisitorSchema, createAnnouncementSchema } from './noticeVisitor.validation.js';
import { validateRequest } from '../../middleware/validate.js';
import {
  authenticate,
  requireWardenOrAdmin,
} from '../../middleware/auth.js';
import { csrfProtection } from '../../middleware/csrf.js';

const router = Router();

// Log external visitor
router.post(
  '/visitors',
  authenticate,
  requireWardenOrAdmin,
  csrfProtection,
  validateRequest(logVisitorSchema),
  noticeVisitorController.logVisitor
);

// Check-out visitor
router.patch(
  '/visitors/:id/check-out',
  authenticate,
  requireWardenOrAdmin,
  csrfProtection,
  noticeVisitorController.checkOutVisitor
);

// List visitors
router.get(
  '/visitors',
  authenticate,
  requireWardenOrAdmin,
  noticeVisitorController.listVisitors
);

// Broadcast safety announcement
router.post(
  '/announcements',
  authenticate,
  requireWardenOrAdmin,
  csrfProtection,
  validateRequest(createAnnouncementSchema),
  noticeVisitorController.createAnnouncement
);

// View announcements (Students and Staff)
router.get(
  '/announcements',
  authenticate,
  noticeVisitorController.getAnnouncements
);

export default router;
