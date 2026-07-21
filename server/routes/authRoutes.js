import express from 'express';
import {
  loginUser,
  registerPatient,
  getMe,
  updateTelegramSettings,
  getStaffMembers,
} from '../controllers/authController.js';
import { protect, requireStaff } from '../middleware/auth.js';

const router = express.Router();

router.post('/login', loginUser);
router.post('/register', registerPatient);
router.get('/me', protect, getMe);
router.put('/telegram', protect, requireStaff, updateTelegramSettings);
router.get('/staff', protect, requireStaff, getStaffMembers);

export default router;
