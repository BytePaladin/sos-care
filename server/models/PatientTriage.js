import mongoose from 'mongoose';

const patientTriageSchema = new mongoose.Schema(
  {
    patientName: { type: String, required: true, trim: true },
    patientPhone: { type: String, required: true, index: true, trim: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // Triage Classification
    category: { type: String, enum: ['red', 'yellow', 'green'], default: 'green', index: true },

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

export const PatientTriage = mongoose.model('PatientTriage', patientTriageSchema);
