import { Router } from 'express';
import { hostelController } from './hostel.controller.js';
import {
  updateHostelConfigSchema,
  testGeofencePointSchema,
  createRoomSchema,
  updateRoomSchema,
} from './hostel.validation.js';
import { validateRequest } from '../../middleware/validate.js';
import {
  authenticate,
  requireAdmin,
  requireWardenOrAdmin,
} from '../../middleware/auth.js';
import { csrfProtection } from '../../middleware/csrf.js';

const router = Router();

// Public/Authenticated read endpoints
router.get('/config', authenticate, hostelController.getConfig);
router.get('/blocks', authenticate, hostelController.listBlocks);
router.get('/blocks/:blockId/rooms', authenticate, hostelController.listRooms);
router.get('/matrix', authenticate, hostelController.getRoomMatrix);

// Geofence coordinate testing endpoint (Students & Wardens can test positioning)
router.post(
  '/geofence/test-point',
  authenticate,
  validateRequest(testGeofencePointSchema),
  hostelController.testGeofencePoint
);

// Admin-only master configuration updates
router.put(
  '/config',
  authenticate,
  requireAdmin,
  csrfProtection,
  validateRequest(updateHostelConfigSchema),
  hostelController.updateConfig
);

// Room management (Wardens & Admins)
router.post(
  '/rooms',
  authenticate,
  requireWardenOrAdmin,
  csrfProtection,
  validateRequest(createRoomSchema),
  hostelController.createRoom
);

router.patch(
  '/rooms/:roomId',
  authenticate,
  requireWardenOrAdmin,
  csrfProtection,
  validateRequest(updateRoomSchema),
  hostelController.updateRoom
);

export default router;
