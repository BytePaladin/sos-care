/**
 * StaffAction.js
 * STAFF_ACTIONS collection from the ER diagram in the Proposal.
 * The audit trail of which staff took what action on which submission is stored here.
 */

import mongoose from 'mongoose'; // for creating schema

const staffActionSchema = new mongoose.Schema(
  {
    // on which triage record the action was taken
    submissionId: {
      type: mongoose.Schema.Types.ObjectId, // ObjectId reference
      ref: 'PatientTriage', // towards PatientTriage collection
      required: true, // must be present
      index: true, // index for fast searching
    },

    // which staff took the action
    staffId: {
      type: mongoose.Schema.Types.ObjectId, // ObjectId reference
      ref: 'User', // towards User collection
      required: true, // must be present
      index: true, // for filtering by staff
    },

    staffName: { type: String, default: '' }, // keep name even if user is deleted later

    // what type of action — action_type of ER diagram
    actionType: {
      type: String, // string enum
      enum: ['STATUS_UPDATE', 'NOTE_ADDED', 'ASSIGNED', 'RESOLVED'], // allowed values
      required: true, // must be present
    },

    // what became the review status of the record after taking the action
    status: {
      type: String, // string enum
      enum: ['pending', 'contacted', 'false_positive', 'needs_review'], // matches PatientTriage
      default: 'pending', // default pending
    },

    note: { type: String, default: '' }, // optional comment
  },
  { timestamps: true } // createdAt / updatedAt will be added automatically
);

// compound index to quickly fetch actions of the same submission by time
staffActionSchema.index({ submissionId: 1, createdAt: -1 });

export const StaffAction = mongoose.model('StaffAction', staffActionSchema); // model export
