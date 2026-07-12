// ============================================================
// src/models/PatientHistory.js
// ER Diagram: PATIENT_HISTORY entity (1 patient : 1 history — "maintains one summary")
// Kaj: DENORMALIZED SUMMARY. Prottek patient er ekta roll-up row.
//
// Keno dorkar? Doctor dashboard e 500 ta patient dekhate hole
// prottek-er jonno countDocuments() chalale 500 ta query hoy (N+1 problem).
// Ei collection e pre-computed thakle: 1 ta query — done.
// Trade-off: Submission create hole eita update korte hobe (write cost).
// Kidney care e read >> write, tai ei trade-off worth it.
// ============================================================

import mongoose from 'mongoose';
import { SEVERITY_ENUM } from './Submission.js';

const patientHistorySchema = new mongoose.Schema(
  {
    // 1:1 relationship — tai unique
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      unique: true,
    },

    // Chhoto text summary — doctor ek nojore dekhbe
    summary: {
      type: String,
      trim: true,
      maxlength: [500, 'Summary cannot exceed 500 characters'],
      default: '',
    },

    // Shesh kobe symptom report korechilo
    lastSymptomDate: {
      type: Date,
      default: null,
    },

    // Mot koyta message pathiyeche
    totalSubmissions: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Shesh bar er final label — dashboard e color badge dekhanor jonno
    lastFinalLabel: {
      type: String,
      enum: [...SEVERITY_ENUM, null],
      default: null,
    },

    // Kotobar RED hoyeche — repeat offender / deteriorating patient dhora porbe
    redCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

const PatientHistory = mongoose.model('PatientHistory', patientHistorySchema);

export default PatientHistory;
