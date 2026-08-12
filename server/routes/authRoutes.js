import express from 'express';
import {
  loginUser,
  registerPatient,
  getMe,
  updateTelegramSettings,
  getStaffMembers,
  sendEmailOtp,
} from '../controllers/authController.js';
import { protect, requireStaff } from '../middleware/auth.js';
import { loginLimiter, registerLimiter } from '../middleware/rateLimit.js'; // Week 5: brute-force guard

const router = express.Router();

// Week 5: the two unauthenticated endpoints are the only ones an attacker can
// reach without a token, so they are the ones that need a request ceiling.
router.post('/send-email-otp', sendEmailOtp);
router.post('/login', loginLimiter, loginUser);
router.post('/register', registerLimiter, registerPatient);
router.get('/me', protect, getMe);
router.put('/telegram', protect, requireStaff, updateTelegramSettings);
router.get('/staff', protect, requireStaff, getStaffMembers);

export default router;
