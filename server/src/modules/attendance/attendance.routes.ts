import { Router } from 'express';
import { attendanceController } from './attendance.controller.js';
import {
  checkInAttendanceSchema,
  manualOverrideSchema,
  getDailyReportSchema,
} from './attendance.validation.js';
import { validateRequest } from '../../middleware/validate.js';
import {
  authenticate,
  requireStudent,
  requireWardenOrAdmin,
} from '../../middleware/auth.js';
import { csrfProtection } from '../../middleware/csrf.js';

const router = Router();

// Student daily attendance submission
router.post(
  '/check-in',
  authenticate,
  requireStudent,
  csrfProtection,
  validateRequest(checkInAttendanceSchema),
  attendanceController.checkIn
);

// Student check today's status & window
router.get(
  '/today',
  authenticate,
  requireStudent,
  attendanceController.getTodayStatus
);

// Student attendance history
router.get(
  '/my-history',
  authenticate,
  requireStudent,
  attendanceController.getMyHistory
);

// Warden / Admin live hostel summary roll-up
router.get(
  '/live-summary',
  authenticate,
  requireWardenOrAdmin,
  attendanceController.getLiveSummary
);

// Warden / Admin daily detailed report
router.get(
  '/daily-report',
  authenticate,
  requireWardenOrAdmin,
  validateRequest(getDailyReportSchema),
  attendanceController.getDailyReport
);

// Warden / Admin manual supervisor override
router.post(
  '/manual-override',
  authenticate,
  requireWardenOrAdmin,
  csrfProtection,
  validateRequest(manualOverrideSchema),
  attendanceController.manualOverride
);

export default router;
