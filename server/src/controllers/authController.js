// ============================================================
// src/controllers/authController.js
// Kaj: PURO authentication flow.
//
// FLOW (patient):
//   1. POST /register     -> account (unverified) + OTP generate
//   2. POST /verify-otp   -> OTP check -> isVerified = true -> JWT dey
//   3. POST /login        -> phone + password -> JWT dey
//
// FLOW (staff):
//   POST /staff/login     -> email + password -> JWT dey
//
// Prottek controller asyncHandler diye mora — try/catch likhte hobe na.
// ============================================================

import crypto from 'crypto';

import Patient from '../models/Patient.js';
import Staff from '../models/Staff.js';
import OtpToken from '../models/OtpToken.js';
import PatientHistory from '../models/PatientHistory.js';

import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { generateToken } from '../utils/generateToken.js';
import env, { isDev } from '../config/env.js';

// ────────────────────────────────────────────────────────────
// HELPER: 6-digit OTP generate kora
// Math.random() use kori NAI — eita cryptographically secure NA,
// predict kora jay. crypto.randomInt() OS er secure RNG use kore.
// ────────────────────────────────────────────────────────────
const generateOtp = () => {
  // 100000 theke 999999 — always exactly 6 digit
  return crypto.randomInt(100000, 1000000).toString();
};

// ────────────────────────────────────────────────────────────
// HELPER: OTP toiri kore DB te rakhe (purono gulo delete kore)
// ────────────────────────────────────────────────────────────
const issueOtp = async (phoneNumber) => {
  // Ei phone er purono/unused OTP gulo mucche feli.
  // Keno? 3 bar "resend" chaile 3 ta valid OTP thakbe — attack surface bare.
  await OtpToken.deleteMany({ phoneNumber });

  const plainOtp = generateOtp();

  await OtpToken.create({
    phoneNumber,
    otpHash: plainOtp, // pre-save hook eta hash kore felbe
    expiresAt: new Date(Date.now() + env.OTP_TTL_MINUTES * 60 * 1000),
  });

  // Development e console e print kori — Telegram/SMS gateway lagbe na
  if (isDev) {
    console.log(`[otp] ${phoneNumber} -> ${plainOtp} (valid ${env.OTP_TTL_MINUTES}m)`);
  }

  // PRODUCTION e ei plainOtp SMS gateway e pathabo, response e NA.
  // Ekhon dev-mode e frontend testing er jonno return korchi.
  return plainOtp;
};

// ============================================================
// @route   POST /api/auth/register
// @desc    Notun patient register kore + OTP pathay
// @access  Public
// ============================================================
export const registerPatient = asyncHandler(async (req, res) => {
  const { fullName, phoneNumber, password, email } = req.body;

  // Ei phone number e already account ache kina
  const existing = await Patient.findOne({ phoneNumber });

  if (existing) {
    // Already verified -> clear conflict
    if (existing.isVerified) {
      throw ApiError.conflict('This phone number is already registered');
    }

    // Register korechilo kintu OTP verify kore nai (browser bondho kore diyechilo)
    // -> notun OTP pathai, notun account banai na. Nahole DB te ghost account jombe.
    const devOtp = await issueOtp(phoneNumber);

    return res.status(200).json({
      success: true,
      message: 'Account exists but is unverified. A new OTP has been sent.',
      data: { phoneNumber, otpExpiresInMinutes: env.OTP_TTL_MINUTES },
      devOtp: isDev ? devOtp : undefined, // production e undefined = JSON e thakbe na
    });
  }

  // Notun patient create kori — password automatic hash hobe (pre-save hook)
  const patient = await Patient.create({
    fullName,
    phoneNumber,
    email: email || undefined, // khali string dile sparse-unique bhange
    passwordHash: password, // plain password dicchi, hook hash kore dibe
    isVerified: false, // OTP na dile login korte parbe na
  });

  // Ei patient er jonno khali history row banai (1:1 relationship)
  await PatientHistory.create({ patientId: patient._id });

  const devOtp = await issueOtp(phoneNumber);

  // 201 = Created
  res.status(201).json({
    success: true,
    message: 'Registration successful. Please verify the OTP sent to your phone.',
    data: {
      patientId: patient._id,
      phoneNumber: patient.phoneNumber,
      otpExpiresInMinutes: env.OTP_TTL_MINUTES,
    },
    devOtp: isDev ? devOtp : undefined,
  });
});

// ============================================================
// @route   POST /api/auth/verify-otp
// @desc    OTP verify kore account activate kore + JWT dey
// @access  Public
// ============================================================
export const verifyOtp = asyncHandler(async (req, res) => {
  const { phoneNumber, otp } = req.body;

  // Ei phone er shob theke notun un-used OTP ta ano
  const otpToken = await OtpToken.findOne({ phoneNumber, isUsed: false }).sort({
    createdAt: -1,
  });

  if (!otpToken) {
    throw ApiError.badRequest('No active OTP found. Please request a new one.');
  }

  // TTL index delete korte kichhu shomoy nite pare — manually o check kori
  if (otpToken.expiresAt < new Date()) {
    throw ApiError.badRequest('OTP has expired. Please request a new one.');
  }

  // Brute-force guard — 5 bar bhul dile ei OTP mere feli
  if (otpToken.attempts >= 5) {
    await OtpToken.deleteOne({ _id: otpToken._id });
    throw ApiError.tooManyRequests('Too many incorrect attempts. Please request a new OTP.');
  }

  // Hash er sathe milai
  const isMatch = await otpToken.compareOtp(otp);

  if (!isMatch) {
    // Attempt count bariye rakhi — nahole infinite try kora jabe
    otpToken.attempts += 1;
    await otpToken.save({ validateBeforeSave: false });

    const remaining = 5 - otpToken.attempts;
    throw ApiError.badRequest(`Invalid OTP. ${remaining} attempt(s) remaining.`);
  }

  // ── OTP thik ache ──
  const patient = await Patient.findOne({ phoneNumber });

  if (!patient) {
    throw ApiError.notFound('Patient account not found');
  }

  patient.isVerified = true;
  await patient.save();

  // OTP ta "used" mark kore feli — replay attack thekabe
  otpToken.isUsed = true;
  await otpToken.save({ validateBeforeSave: false });

  // Verify hoye gele shathe shathe login kore dei — extra step lagbe na
  const token = generateToken(patient._id, 'PATIENT');

  res.status(200).json({
    success: true,
    message: 'Phone number verified successfully',
    data: {
      token,
      user: {
        id: patient._id,
        name: patient.fullName, // frontend App.jsx `user.name` expect kore
        phone: patient.phoneNumber,
        role: 'PATIENT',
        isVerified: true,
      },
    },
  });
});

// ============================================================
// @route   POST /api/auth/resend-otp
// @desc    Notun OTP pathay
// @access  Public (rate-limited: 5 per 15 min)
// ============================================================
export const resendOtp = asyncHandler(async (req, res) => {
  const { phoneNumber } = req.body;

  const patient = await Patient.findOne({ phoneNumber });

  if (!patient) {
    throw ApiError.notFound('No account found with this phone number');
  }

  if (patient.isVerified) {
    throw ApiError.badRequest('This account is already verified. Please log in.');
  }

  const devOtp = await issueOtp(phoneNumber);

  res.status(200).json({
    success: true,
    message: 'A new OTP has been sent to your phone',
    data: { phoneNumber, otpExpiresInMinutes: env.OTP_TTL_MINUTES },
    devOtp: isDev ? devOtp : undefined,
  });
});

// ============================================================
// @route   POST /api/auth/login
// @desc    Patient login (phone + password) -> JWT
// @access  Public (rate-limited: 10 per 15 min)
// ============================================================
export const loginPatient = asyncHandler(async (req, res) => {
  const { phoneNumber, password } = req.body;

  // ── .select('+passwordHash') KENO? ──
  // Model e passwordHash er `select: false` deya ache, tai default query te
  // eita ashe NA. Compare korte hole explicitly chaite hobe.
  const patient = await Patient.findOne({ phoneNumber }).select('+passwordHash');

  // ── SECURITY: "user nai" ar "password bhul" — DUITAR message SAME ──
  // Alada message dile attacker jene jabe kon phone number registered.
  // Eita user enumeration attack.
  if (!patient || !(await patient.comparePassword(password))) {
    throw ApiError.unauthorized('Invalid phone number or password');
  }

  if (!patient.isVerified) {
    throw ApiError.forbidden('Please verify your phone number before logging in');
  }

  if (!patient.isActive) {
    throw ApiError.forbidden('This account has been deactivated. Contact support.');
  }

  const token = generateToken(patient._id, 'PATIENT');

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      token,
      user: {
        id: patient._id,
        name: patient.fullName,
        phone: patient.phoneNumber,
        role: 'PATIENT',
        isVerified: patient.isVerified,
      },
    },
  });
});

// ============================================================
// @route   POST /api/auth/staff/login
// @desc    Doctor / Nurse / Admin login (email + password) -> JWT
// @access  Public (rate-limited)
// ============================================================
export const loginStaff = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const staff = await Staff.findOne({ email: email.toLowerCase() }).select('+passwordHash');

  // Same generic message — enumeration thekabe
  if (!staff || !(await staff.comparePassword(password))) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  if (!staff.isActive) {
    throw ApiError.forbidden('This staff account has been deactivated');
  }

  // Staff er ROLE token e jay — authorize() ei role check korbe
  const token = generateToken(staff._id, staff.role);

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      token,
      user: {
        id: staff._id,
        name: staff.fullName,
        email: staff.email,
        role: staff.role, // DOCTOR | NURSE | ADMIN
        department: staff.department,
      },
    },
  });
});

// ============================================================
// @route   GET /api/auth/me
// @desc    Token diye nijer profile ano
// @access  Private (protect middleware lagbe)
// ============================================================
export const getMe = asyncHandler(async (req, res) => {
  // protect() middleware age-i req.user set kore diyeche —
  // ekhane DB te abar query korar dorkar nai.
  res.status(200).json({
    success: true,
    data: {
      user: req.user, // toJSON transform passwordHash bad diye dibe
      role: req.userRole,
    },
  });
});
