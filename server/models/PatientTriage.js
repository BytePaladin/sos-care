import mongoose from 'mongoose';
import { higherSeverity } from '../utils/severity.js'; // দুই label আলাদা হলে বেশি জরুরিটি বেছে নিতে

/**
 * PatientTriage.js
 * Week 3 update: proposal Appendix C অনুযায়ী audit field যোগ করা হয়েছে —
 * mlLabel (model কী বলেছিল), ruleOverride (safety-net চালু হয়েছিল কিনা),
 * finalLabel (queue-তে যেটি ব্যবহার হচ্ছে) এবং matchedKeywords.
 * পুরনো `category` field রাখা হয়েছে যাতে frontend ভেঙে না যায়.
 */

const patientTriageSchema = new mongoose.Schema(
  {
    patientName: { type: String, required: true, trim: true },
    patientPhone: { type: String, required: true, index: true, trim: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // Triage Classification (frontend এটিই পড়ে — finalLabel এর সাথে সব সময় sync থাকে)
    category: { type: String, enum: ['red', 'yellow', 'green'], default: 'green', index: true },

    // ── Week 3: Hybrid decision audit trail (Proposal Figure 2 / Appendix C) ──
    mlLabel: {
      type: String, // ML classifier কী label দিয়েছিল
      enum: ['red', 'yellow', 'green'], // তিনটি tier-ই অনুমোদিত
      default: 'green', // কিছু না পেলে green
    },
    ruleOverride: {
      type: Boolean, // safety-net keyword layer চালু হয়েছিল কিনা
      default: false, // default হলো override হয়নি
    },
    finalLabel: {
      type: String, // override প্রয়োগের পর চূড়ান্ত label
      enum: ['red', 'yellow', 'green'], // তিনটি tier
      default: 'green', // default green
      index: true, // priority queue sort-এ ব্যবহার হয়
    },
    matchedKeywords: [{ type: String }], // কোন কোন critical rule hit করেছিল
    modelSource: {
      type: String, // label কোথা থেকে এলো
      enum: ['ml-service', 'fallback-heuristic', 'empty-input', 'manual'], // সম্ভাব্য উৎস
      default: 'fallback-heuristic', // Flask service না থাকলে এটাই
    },

    // Clinical Screening Metadata
    aiAnalysis: {
      symptomSummary: { type: String, default: '' },
      symptomTags: [{ type: String }],
      confidenceScore: { type: Number, default: 0 },
      riskFactors: [{ type: String }],
    },

    // Review Workflow Status
    reviewStatus: {
      type: String,
      enum: ['pending', 'contacted', 'false_positive', 'needs_review'],
      default: 'pending',
      index: true,
    },
    reviewComment: { type: String, default: '' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    forwardedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // Clinical Notes Timeline
    notes: [
      {
        author: { type: String, required: true },
        authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        text: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
      },
    ],

    screenedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Doctor dashboard-এর queue query দ্রুত করার জন্য compound index
patientTriageSchema.index({ reviewStatus: 1, finalLabel: 1, screenedAt: -1 });

/**
 * save করার আগে category ও finalLabel সব সময় একই রাখা হয়.
 * এতে পুরনো frontend (category) আর নতুন code (finalLabel) দুটোই ঠিক থাকে.
 */
patientTriageSchema.pre('save', function (next) {
  // মনে রাখা দরকার: Mongoose-এ default দিয়ে বসা field কে isModified() modified ধরে না,
  // তাই নিচের শর্তগুলো ঠিকভাবেই কাজ করে (seed.js শুধু category দেয়, controller শুধু finalLabel দেয়).
  if (this.isModified('finalLabel')) {
    this.category = this.finalLabel; // নতুন code → পুরনো field sync
  } else if (this.isModified('category')) {
    this.finalLabel = this.category; // পুরনো code → নতুন field sync
  }

  // fail-safe: কোনো কারণে দুটি আলাদা থেকে গেলে বেশি জরুরি label-টিই রাখা হয়
  if (this.category !== this.finalLabel) {
    const safest = higherSeverity(this.category, this.finalLabel); // Red > Yellow > Green
    this.category = safest; // দুই field-ই
    this.finalLabel = safest; // একই নিরাপদ মানে আনা
  }

  next(); // save চালিয়ে যাওয়া
});

export const PatientTriage = mongoose.model('PatientTriage', patientTriageSchema);
