// ============================================================
// src/models/SeverityLevel.js
// ER Diagram: SEVERITY_LEVEL entity
// Kaj: GREEN / YELLOW / RED — eder naam, priority order, description.
// Keno alada collection (hard-code na kore)?
//   1. Dashboard e sorting korte priorityOrder lage (RED=1 shobar upore)
//   2. Bhobisshot e 5-tier (ESI scale) e jete hole schema change lagbe na
//   3. Level er description UI te dekhano jay — code deploy chhara-i
// ============================================================

import mongoose from 'mongoose';

const severityLevelSchema = new mongoose.Schema(
  {
    // Machine-readable code — Submission.finalLabel ei value gulo-i rakhe
    levelCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true, // 'green' likhleo DB te 'GREEN' hobe
      enum: ['GREEN', 'YELLOW', 'RED'],
    },

    // Human-readable naam — doctor dashboard e ei ta dekha jabe
    levelName: {
      type: String,
      required: true,
      // Routine | Needs Review | Urgent
    },

    // 1 = HIGHEST priority. Doctor dashboard e:  .sort({ priorityOrder: 1 })
    // RED = 1, YELLOW = 2, GREEN = 3  ->  RED first, GREEN last
    priorityOrder: {
      type: Number,
      required: true,
      unique: true,
      min: 1,
    },

    // Ei level mane ki — UI tooltip / legend e dekhabo
    description: {
      type: String,
      default: '',
    },

    // Hex color — frontend badge er color ekhan theke nite parbe
    colorHex: {
      type: String,
      default: '#6b7280',
    },
  },
  { timestamps: true }
);

const SeverityLevel = mongoose.model('SeverityLevel', severityLevelSchema);

export default SeverityLevel;
