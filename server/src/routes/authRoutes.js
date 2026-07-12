// ============================================================
// src/routes/authRoutes.js
// Kaj: URL -> middleware chain -> controller er mapping.
//
// Middleware ORDER ta khub important. Ekta request ei order e jay:
//   rateLimiter -> validationRules -> validate -> controller
// ============================================================

import express from 'express';
import { body } from 'express-validator';

import {
  registerPatient,
  verifyOtp,
  resendOtp,
  loginPatient,
  loginStaff,
  getMe,
} from '../controllers/authController.js';

import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { loginLimiter, otpLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// ────────────────────────────────────────────────────────────
// VALIDATION RULES
// Frontend (SignUpPage.jsx) er password criteria HUBAHU mirror kori.
// Frontend check bypass kora jay (Postman), server check jay na.
// ────────────────────────────────────────────────────────────

const registerRules = [
  body('fullName')
    .trim()
    .notEmpty()
    .withMessage('Full name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters'),

  body('phoneNumber')
    .trim()
    .matches(/^01[3-9]\d{8}$/)
    .withMessage('Phone number must be a valid Bangladeshi number (01XXXXXXXXX)'),

  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/\d/)
    .withMessage('Password must contain a number')
    .matches(/[a-z]/)
    .withMessage('Password must contain a lowercase letter')
    .matches(/[A-Z]/)
    .withMessage('Password must contain an uppercase letter')
    .matches(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/)
    .withMessage('Password must contain a special character'),

  // Email optional — dile valid hote hobe
  body('email')
    .optional({ checkFalsy: true })
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
];

const otpRules = [
  body('phoneNumber')
    .trim()
    .matches(/^01[3-9]\d{8}$/)
    .withMessage('A valid phone number is required'),

  body('otp')
    .trim()
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be exactly 6 digits')
    .isNumeric()
    .withMessage('OTP must contain only digits'),
];

const loginRules = [
  body('phoneNumber').trim().notEmpty().withMessage('Phone number is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

const staffLoginRules = [
  body('email').trim().isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

// ────────────────────────────────────────────────────────────
// PUBLIC ROUTES — token lagbe na
// ────────────────────────────────────────────────────────────

// POST /api/auth/register
router.post('/register', otpLimiter, registerRules, validate, registerPatient);

// POST /api/auth/verify-otp
router.post('/verify-otp', loginLimiter, otpRules, validate, verifyOtp);

// POST /api/auth/resend-otp
router.post(
  '/resend-otp',
  otpLimiter,
  [body('phoneNumber').trim().matches(/^01[3-9]\d{8}$/).withMessage('A valid phone number is required')],
  validate,
  resendOtp
);

// POST /api/auth/login          (patient)
router.post('/login', loginLimiter, loginRules, validate, loginPatient);

// POST /api/auth/staff/login    (doctor / nurse / admin)
router.post('/staff/login', loginLimiter, staffLoginRules, validate, loginStaff);

// ────────────────────────────────────────────────────────────
// PRIVATE ROUTES — protect middleware lagbe
// ────────────────────────────────────────────────────────────

// GET /api/auth/me
router.get('/me', protect, getMe);

export default router;
