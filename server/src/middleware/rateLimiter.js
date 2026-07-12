// ============================================================
// src/middleware/rateLimiter.js
// Kaj: Brute-force attack thekano.
//
// Chhara: attacker script chaliye 1 second e 1000 bar login try korte pare.
// 6-digit OTP = 1,000,000 combination — automated script e minute e bhenge jabe.
// ============================================================

import rateLimit from 'express-rate-limit';

/**
 * loginLimiter — login endpoint er jonno kora
 * 15 minute e ekta IP theke max 10 bar login try
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minute (millisecond e)
  max: 10, // ei window te max 10 ta request
  standardHeaders: true, // RateLimit-* header pathabe
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again after 15 minutes.',
  },
});

/**
 * otpLimiter — OTP request er jonno kora (aro kora)
 * 15 minute e max 5 bar OTP chaite parbe — SMS/Telegram spam thekabe
 */
export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many OTP requests. Please wait 15 minutes before trying again.',
  },
});

/**
 * globalLimiter — puro API te general protection
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300, // normal user ei limit e kokhono porbe na
  standardHeaders: true,
  legacyHeaders: false,
});
