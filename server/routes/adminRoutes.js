import express from 'express';
import {
  adminLogin,
  createStaffAccount,
  getAllUsers,
  deleteUserAccount,
  getHospitalAnalytics,
  getStaffAnalytics,
  getStaffActions,
} from '../controllers/adminController.js';
import { protect, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Public Admin Login
router.post('/login', adminLogin);

// Protected Admin Routes
router.post('/staff', protect, requireAdmin, createStaffAccount);
router.get('/users', protect, requireAdmin, getAllUsers);
router.delete('/users/:id', protect, requireAdmin, deleteUserAccount);
router.get('/analytics', protect, requireAdmin, getHospitalAnalytics);
router.get('/staff-analytics', protect, requireAdmin, getStaffAnalytics);
router.get('/staff-actions', protect, requireAdmin, getStaffActions);

export default router;
