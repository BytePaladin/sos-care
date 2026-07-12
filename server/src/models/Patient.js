// ============================================================
// src/models/Patient.js
// ER Diagram: PATIENT entity
// Design decision: proposal-er ER te `email` ke UNIQUE dhora hoyechilo,
//   kintu frontend (LoginPage.jsx / SignUpPage.jsx) phone number diye
//   login kore. Tai -> phoneNumber = unique login key,
//                     email        = optional (sparse unique).
//   Eita Weekly Progress Report 1 e documented ache.
// ============================================================

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import env from '../config/env.js';

const patientSchema = new mongoose.Schema(
  {
    // Patient er puro naam — signup form er "Full Name" field
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true, // shamner/pichoner extra space kete dey
      minlength: [2, 'Full name must be at least 2 characters'],
      maxlength: [100, 'Full name cannot exceed 100 characters'],
    },

    // PRIMARY LOGIN IDENTIFIER — Bangladeshi mobile format: 01XXXXXXXXX
    phoneNumber: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true, // duijon patient ek phone number use korte parbe na
      trim: true,
      // ^01 diye shuru, tarpor 3-9 er ekta digit, tarpor 8 ta digit = mot 11
      match: [/^01[3-9]\d{8}$/, 'Phone number must be a valid Bangladeshi number (01XXXXXXXXX)'],
    },

    // Email optional — sparse:true mane null value gulo unique check e porbe na
    email: {
      type: String,
      unique: true,
      sparse: true, // eita chhara multiple null email save kora jabe na
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },

    // bcrypt hash — PLAIN password kokhono DB te jabe na
    passwordHash: {
      type: String,
      required: [true, 'Password is required'],
      select: false, // default query te eita return hobe na (accidental leak thekabe)
    },

    // Kidney patient er age/gender clinical context e dorkar hoy
    dateOfBirth: {
      type: Date,
      default: null,
    },

    gender: {
      type: String,
      enum: ['MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED'],
      default: 'UNSPECIFIED',
    },

    address: {
      type: String,
      trim: true,
      maxlength: [250, 'Address cannot exceed 250 characters'],
      default: '',
    },

    // OTP verify na kora porjonto login block thakbe
    isVerified: {
      type: Boolean,
      default: false,
    },

    // Admin chaile account suspend korte parbe
    isActive: {
      type: Boolean,
      default: true,
    },

    // JWT payload e role bosanor jonno — patient route gulo protect korte lagbe
    role: {
      type: String,
      default: 'PATIENT',
      immutable: true, // keu update kore STAFF hoye jete parbe na
    },
  },
  {
    // createdAt + updatedAt automatic add kore dey (ER diagram er created_at/updated_at)
    timestamps: true,
    // JSON e convert korar shomoy sensitive field baad dey
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.passwordHash; // double safety — select:false er upore ekta layer
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ── Index: dashboard e patient khoja fast korar jonno ──
patientSchema.index({ fullName: 'text' }); // text search on name

// ── PRE-SAVE HOOK ──
// save() call korar age automatic cholbe. Password hash kora ekhane hoy,
// tai controller e bar bar hash korte hoy na — ek jaygay logic.
patientSchema.pre('save', async function (next) {
  // Jodi passwordHash change na hoy (jemon: address update), tahole re-hash korar dorkar nei
  if (!this.isModified('passwordHash')) return next();

  // Salt generate kori — salt rounds jotoi beshi, brute-force totoi kothin
  const salt = await bcrypt.genSalt(env.BCRYPT_SALT_ROUNDS);

  // Plain password ke hash e replace kore dey
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);

  next(); // next middleware e jao (ba save complete koro)
});

// ── INSTANCE METHOD ──
// Login er shomoy: patient.comparePassword('Demo@1234') -> true/false
patientSchema.methods.comparePassword = async function (plainPassword) {
  // bcrypt.compare nije-i salt extract kore hash miliye dekhe
  return bcrypt.compare(plainPassword, this.passwordHash);
};

const Patient = mongoose.model('Patient', patientSchema);

export default Patient;
