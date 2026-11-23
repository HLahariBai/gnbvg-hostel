import { Router } from 'express';
import { adminController } from './admin.controller.js';
import {
  triageIntrusionSchema,
  addSingleRegistrySchema,
  bulkRegistrySchema,
} from './admin.validation.js';
import { validateRequest } from '../../middleware/validate.js';
import {
  authenticate,
  requireAdmin,
  requireWardenOrAdmin,
} from '../../middleware/auth.js';
import { csrfProtection } from '../../middleware/csrf.js';

const router = Router();

// Dashboard KPI overview
router.get(
  '/dashboard-kpis',
  authenticate,
  requireWardenOrAdmin,
  adminController.getDashboardKPIs
);

// Intrusion monitoring feed
router.get(
  '/intrusions',
  authenticate,
  requireWardenOrAdmin,
  adminController.getIntrusions
);

// Triage intrusion attempt (Acknowledge, Flag to Principal, Whitelist)
router.patch(
  '/intrusions/:id',
  authenticate,
  requireWardenOrAdmin,
  csrfProtection,
  validateRequest(triageIntrusionSchema),
  adminController.triageIntrusion
);

// Master Hosteller Registry management
router.get(
  '/registry',
  authenticate,
  requireWardenOrAdmin,
  adminController.listRegistry
);

router.post(
  '/registry/single',
  authenticate,
  requireAdmin,
  csrfProtection,
  validateRequest(addSingleRegistrySchema),
  adminController.addSingleRegistry
);

router.post(
  '/registry/bulk',
  authenticate,
  requireAdmin,
  csrfProtection,
  validateRequest(bulkRegistrySchema),
  adminController.bulkUploadRegistry
);

// Annual academic year rollover
router.post(
  '/rollover',
  authenticate,
  requireAdmin,
  csrfProtection,
  adminController.annualRollover
);

// Immutable system audit logs
router.get(
  '/audit-logs',
  authenticate,
  requireAdmin,
  adminController.getAuditLogs
);

export default router;
