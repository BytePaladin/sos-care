// ============================================================
// src/models/Submission.js
// ER Diagram: SUBMISSION (Message) entity
// Proposal Appendix C er schema er sathe 1:1 match kore.
//
// Eita project er HEART. Ekhane mlLabel, ruleOverride, finalLabel —
// tinta alada field rakha hoyeche, ekta na. Karon:
//   - mlLabel      = model ki bolechhilo (audit er jonno)
//   - ruleOverride = safety-net keyword hit hoyechilo kina
//   - finalLabel   = actual queue value (dashboard eita dekhe)
// Tinta alada thakle bhobisshot e proman kora jabe:
//   "model bhul bolechilo, safety-net dhore felechilo" — evaluation metric.
// ============================================================

import mongoose from 'mongoose';

// Enum gulo ek jaygay rakhi — repeat korle typo hoy
const SEVERITY_ENUM = ['GREEN', 'YELLOW', 'RED'];
const STATUS_ENUM = ['NEW', 'UNDER_REVIEW', 'IN_PROGRESS', 'RESOLVED'];

const submissionSchema = new mongoose.Schema(
  {
    // Kon patient message ta pathiyeche — FK to PATIENT
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient', // populate() korle Patient doc chole asbe
      required: [true, 'patientId is required'],
      index: true, // patient history query fast korar jonno
    },

    // Patient jeta free-text e likheche — "My legs are swelling more than usual"
    messageText: {
      type: String,
      required: [true, 'Message text is required'],
      trim: true,
      minlength: [3, 'Message is too short to triage'],
      maxlength: [2000, 'Message cannot exceed 2000 characters'],
    },

    // ── ML CLASSIFIER OUTPUT (Flask microservice theke ashe) ──
    mlLabel: {
      type: String,
      enum: SEVERITY_ENUM,
      default: null, // Flask service down thakle null thakbe
    },

    // Model koto confident chilo (0.0 - 1.0) — low confidence flag korte parbo
    mlConfidence: {
      type: Number,
      min: 0,
      max: 1,
      default: null,
    },

    // ── SAFETY-NET LAYER ──
    // true = critical keyword pawa gechhe, ML jai boluk RED e force kora hoyeche
    ruleOverride: {
      type: Boolean,
      default: false,
    },

    // Kon keyword ta hit korlo — audit trail (jemon: "can't pass urine")
    matchedKeywords: {
      type: [String],
      default: [],
    },

    // ── FINAL LABEL — dashboard queue ei value diye sort hoy ──
    // Rule: finalLabel = ruleOverride ? 'RED' : mlLabel
    finalLabel: {
      type: String,
      enum: SEVERITY_ENUM,
      required: [true, 'finalLabel is required'],
      default: 'YELLOW', // FAIL-SAFE: ML down thakle GREEN na, YELLOW —
      // manush review korbe, silently drop hobe na
      index: true,
    },

    // Doctor/nurse ei case ta niye ki korlo
    status: {
      type: String,
      enum: STATUS_ENUM,
      default: 'NEW',
      index: true,
    },

    // Kon staff ke assign kora hoyeche (null = ekhono keu nei)
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      default: null,
    },
  },
  { timestamps: true }
);

// ── COMPOUND INDEX — sob theke important index ei project e ──
// Doctor dashboard er MAIN query:
//   Submission.find({ status: 'NEW' }).sort({ finalLabel: 1, createdAt: 1 })
// Ei index ta chhara MongoDB pura collection scan korbe (slow).
submissionSchema.index({ status: 1, finalLabel: 1, createdAt: -1 });

// Ek patient er shob submission time order e — patient history page er jonno
submissionSchema.index({ patientId: 1, createdAt: -1 });

// ── VIRTUAL FIELD ──
// DB te save hoy na, kintu JSON e chole ashe. RED ache kina quick check.
submissionSchema.virtual('isUrgent').get(function () {
  return this.finalLabel === 'RED';
});

// Virtual gulo JSON output e include korte hobe (default e hoy na)
submissionSchema.set('toJSON', { virtuals: true });

// Enum gulo export kori — controller/validator eguloi reuse korbe
export { SEVERITY_ENUM, STATUS_ENUM };

const Submission = mongoose.model('Submission', submissionSchema);

export default Submission;
