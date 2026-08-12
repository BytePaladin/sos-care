import mongoose from 'mongoose';
import { higherSeverity } from '../utils/severity.js'; // to pick the more urgent one if two labels differ

/**
 * PatientTriage.js
 * Week 3 update: audit fields added according to proposal Appendix C —
 * mlLabel (what model said), ruleOverride (whether safety-net was triggered),
 * finalLabel (which is used in queue) and matchedKeywords.
 * The old `category` field is kept so frontend doesn't break.
 */

const patientTriageSchema = new mongoose.Schema(
  {
    patientName: { type: String, required: true, trim: true },
    patientPhone: { type: String, required: true, index: true, trim: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // Triage Classification (frontend reads this — always in sync with finalLabel)
    category: { type: String, enum: ['red', 'yellow', 'green'], default: 'green', index: true },

    // ── Week 3: Hybrid decision audit trail (Proposal Figure 2 / Appendix C) ──
    mlLabel: {
      type: String, // what label ML classifier gave
      enum: ['red', 'yellow', 'green'], // all three tiers allowed
      default: 'green', // green if nothing is found
    },
    ruleOverride: {
      type: Boolean, // whether safety-net keyword layer was triggered
      default: false, // default is not overridden
    },
    finalLabel: {
      type: String, // final label after override applied
      enum: ['red', 'yellow', 'green'], // three tiers
      default: 'green', // default green
      index: true, // used in priority queue sort
    },
    matchedKeywords: [{ type: String }], // which critical rules hit
    modelSource: {
      type: String, // where the label came from
      enum: ['ml-service', 'fallback-heuristic', 'empty-input', 'manual'], // possible sources
      default: 'fallback-heuristic', // this one if Flask service absent
    },

    // Clinical Screening Metadata
    aiAnalysis: {
      symptomSummary: { type: String, default: '' },
      symptomTags: [{ type: String }],
      confidenceScore: { type: Number, default: 0 },
      riskFactors: [{ type: String }],
    },

    // Original AI Assigned Category before doctor override
    initialCategory: {
      type: String,
      enum: ['red', 'yellow', 'green'],
      default: function () {
        return this.finalLabel || this.category || 'green';
      },
    },

    // Doctor Severity Override Tracking (Escalation / De-escalation)
    doctorOverride: {
      isOverridden: { type: Boolean, default: false },
      overriddenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      overriddenByName: { type: String, default: '' },
      overriddenAt: { type: Date, default: null },
      previousCategory: { type: String, enum: ['red', 'yellow', 'green', ''], default: '' },
      reason: { type: String, default: '' },
    },

    // Review Workflow Status
    reviewStatus: {
      type: String,
      enum: ['pending', 'contacted', 'false_positive', 'needs_review', 'reviewed'],
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

// Compound index to speed up queue query in Doctor dashboard
patientTriageSchema.index({ reviewStatus: 1, finalLabel: 1, screenedAt: -1 });

/**
 * category and finalLabel are always kept the same before saving.
 * This ensures both old frontend (category) and new code (finalLabel) are fine.
 */
patientTriageSchema.pre('save', function (next) {
  // Remember: fields populated by default are not considered modified by isModified() in Mongoose,
  // so the conditions below work correctly (seed.js only gives category, controller only gives finalLabel).
  if (this.isModified('finalLabel')) {
    this.category = this.finalLabel; // new code → sync old field
  } else if (this.isModified('category')) {
    this.finalLabel = this.category; // old code → sync new field
  }

  // fail-safe: if for some reason they remain different, the more urgent label is kept
  if (this.category !== this.finalLabel) {
    const safest = higherSeverity(this.category, this.finalLabel); // Red > Yellow > Green
    this.category = safest; // both fields
    this.finalLabel = safest; // brought to same safe value
  }

  next(); // proceed to save
});

export const PatientTriage = mongoose.model('PatientTriage', patientTriageSchema);
