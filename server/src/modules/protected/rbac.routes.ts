import { Router, type Request, type Response } from 'express';
import {
  authenticate,
  requireStudent,
  requireWarden,
  requireAdmin,
  requireWardenOrAdmin,
} from '../../middleware/auth.js';

const router = Router();

// Student-Only Route
router.get('/student-area', authenticate, requireStudent, (req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    message: 'Authorized: Access granted to Student/Resident protected area.',
    user: req.user,
  });
});

// Warden-Only Route
router.get('/warden-area', authenticate, requireWarden, (req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    message: 'Authorized: Access granted to Warden operational area.',
    user: req.user,
  });
});

// Admin-Only Route
router.get('/admin-area', authenticate, requireAdmin, (req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    message: 'Authorized: Access granted to Administrator management area.',
    user: req.user,
  });
});

// Warden or Admin Route
router.get('/staff-area', authenticate, requireWardenOrAdmin, (req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    message: 'Authorized: Access granted to Hostel Staff (Warden / Admin) area.',
    user: req.user,
  });
});

export default router;
