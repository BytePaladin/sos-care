// ============================================================
// src/models/OtpToken.js
// NOTE: Eita ER diagram e chhilo NA — ami add korechhi.
//
// KENO?  Frontend (SignUpPage.jsx) e OTP logic client-side chhilo:
//   const botToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
// VITE_ prefix mane eita BROWSER BUNDLE e chole jay — je keu
// DevTools khule bot token dekhte parbe. Eita ekta SECURITY BUG.
//
// FIX: OTP generate + verify EKHON SERVER er kaj. Browser shudhu
//      6-digit code post kore. Token server e thake, kokhono client e jay na.
//
// Ei decision Weekly Progress Report 2 e documented.
// ============================================================

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import env from '../config/env.js';

const otpTokenSchema = new mongoose.Schema(
  {
    // Kar jonno OTP — phone number (patient ekhono create hoy nai)
    phoneNumber: {
      type: String,
      required: true,
      index: true,
    },

    // OTP ta-o HASH kore rakhi. Keno? DB leak hole plain OTP diye
    // attacker jekono account verify kore felte parto.
    otpHash: {
      type: String,
      required: true,
    },

    // Koto bar bhul try korlo — brute-force (10^6 = 1M combination) thekabe
    attempts: {
      type: Number,
      default: 0,
      max: 5,
    },

    // Use kora hoye gele true — same OTP duibar use kora jabe na (replay attack)
    isUsed: {
      type: Boolean,
      default: false,
    },

    // Kokhon expire hobe
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// ── TTL INDEX — MongoDB er built-in magic ──
// expireAfterSeconds: 0 mane -> expiresAt er time pass hoye gelei MongoDB
// nije-i document ta DELETE kore dey. Amake kono cron job likhte hobe na.
otpTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Save korar age OTP hash kori
otpTokenSchema.pre('save', async function (next) {
  if (!this.isModified('otpHash')) return next();
  const salt = await bcrypt.genSalt(env.BCRYPT_SALT_ROUNDS);
  this.otpHash = await bcrypt.hash(this.otpHash, salt);
  next();
});

// OTP milanor jonno
otpTokenSchema.methods.compareOtp = async function (plainOtp) {
  return bcrypt.compare(plainOtp, this.otpHash);
};

const OtpToken = mongoose.model('OtpToken', otpTokenSchema);

export default OtpToken;
