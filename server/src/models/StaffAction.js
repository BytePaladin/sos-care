// ============================================================
// src/models/StaffAction.js
// ER Diagram: STAFF_ACTIONS entity
// Kaj: AUDIT TRAIL. Kon staff, kon submission e, kokhon, ki korlo.
//
// Medical system e eita optional na — legal requirement.
// "Ei RED case ta 3 ghonta poreo keu dekhe nai keno?" — ei prosno er
// uttor ei collection theke-i ashe.
// Submission.status overwrite hoy, kintu ei collection e append-only.
// ============================================================

import mongoose from 'mongoose';
import { STATUS_ENUM } from './Submission.js';

// ER diagram: action_type [STATUS_UPDATE | NOTE_ADDED | ASSIGNED | RESOLVED]
const ACTION_TYPE_ENUM = ['STATUS_UPDATE', 'NOTE_ADDED', 'ASSIGNED', 'RESOLVED', 'VIEWED'];

const staffActionSchema = new mongoose.Schema(
  {
    // Kon submission er upor action nea holo — FK
    submissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Submission',
      required: true,
      index: true,
    },

    // Ke action ta nilo — FK to STAFF
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      required: true,
      index: true,
    },

    // Ki dhoroner action
    actionType: {
      type: String,
      enum: ACTION_TYPE_ENUM,
      required: true,
    },

    // Action er por submission er status ki holo
    status: {
      type: String,
      enum: STATUS_ENUM,
      default: null,
    },

    // Doctor er clinical note (optional)
    note: {
      type: String,
      trim: true,
      maxlength: [1000, 'Note cannot exceed 1000 characters'],
      default: '',
    },
  },
  {
    // updatedAt lagbe na — audit log NEVER update hoy, shudhu create hoy
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Ek submission er timeline dekhanor jonno (newest first)
staffActionSchema.index({ submissionId: 1, createdAt: -1 });

export { ACTION_TYPE_ENUM };

const StaffAction = mongoose.model('StaffAction', staffActionSchema);

export default StaffAction;
