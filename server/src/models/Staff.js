// ============================================================
// src/models/Staff.js
// ER Diagram: STAFF entity
// Kaj: Doctor / Nurse / Admin — jara dashboard e prioritized queue dekhbe.
// Note: Staff email diye login kore (hospital email), patient phone diye.
//       Alada model rakhar karon: role-based access clean hoy, ar
//       patient collection e clinical staff mishe jay na.
// ============================================================

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import env from '../config/env.js';

const staffSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      maxlength: [100, 'Full name cannot exceed 100 characters'],
    },

    // Staff er PRIMARY LOGIN IDENTIFIER — hospital email
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },

    passwordHash: {
      type: String,
      required: [true, 'Password is required'],
      select: false, // query te by-default asbe na
    },

    // ER diagram: role [DOCTOR | NURSE | ADMIN]
    // Eita-i middleware/auth.js er authorize() function e use hobe
    role: {
      type: String,
      required: true,
      enum: {
        values: ['DOCTOR', 'NURSE', 'ADMIN'],
        message: '{VALUE} is not a valid staff role',
      },
    },

    phoneNumber: {
      type: String,
      trim: true,
      match: [/^01[3-9]\d{8}$/, 'Phone number must be a valid Bangladeshi number'],
    },

    // Doctor ke kon department e assign kora — future filtering er jonno
    department: {
      type: String,
      trim: true,
      default: 'Nephrology',
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Role diye filter kora dashboard e common -> index kore fast kori
staffSchema.index({ role: 1, isActive: 1 });

// Patient model er motoi — save korar age password hash kore
staffSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  const salt = await bcrypt.genSalt(env.BCRYPT_SALT_ROUNDS);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
  next();
});

// Login e password milanor jonno
staffSchema.methods.comparePassword = async function (plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

const Staff = mongoose.model('Staff', staffSchema);

export default Staff;
