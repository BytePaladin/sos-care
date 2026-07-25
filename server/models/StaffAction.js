/**
 * StaffAction.js
 * Proposal-এর ER diagram-এ থাকা STAFF_ACTIONS collection.
 * কোন staff কোন submission-এ কী action নিলো তার audit trail এখানে জমা হয়.
 */

import mongoose from 'mongoose'; // schema তৈরির জন্য

const staffActionSchema = new mongoose.Schema(
  {
    // কোন triage record-এর উপর action নেওয়া হয়েছে
    submissionId: {
      type: mongoose.Schema.Types.ObjectId, // ObjectId reference
      ref: 'PatientTriage', // PatientTriage collection-এর দিকে
      required: true, // অবশ্যই থাকতে হবে
      index: true, // দ্রুত খোঁজার জন্য index
    },

    // কোন staff action নিয়েছে
    staffId: {
      type: mongoose.Schema.Types.ObjectId, // ObjectId reference
      ref: 'User', // User collection-এর দিকে
      required: true, // অবশ্যই থাকতে হবে
      index: true, // staff অনুযায়ী filter করার জন্য
    },

    staffName: { type: String, default: '' }, // পরে user মুছে গেলেও নাম যেন থাকে

    // কী ধরনের action — ER diagram-এর action_type
    actionType: {
      type: String, // string enum
      enum: ['STATUS_UPDATE', 'NOTE_ADDED', 'ASSIGNED', 'RESOLVED'], // অনুমোদিত মানগুলো
      required: true, // অবশ্যই থাকতে হবে
    },

    // action নেওয়ার পর record-এর review status কী হলো
    status: {
      type: String, // string enum
      enum: ['pending', 'contacted', 'false_positive', 'needs_review'], // PatientTriage-এর সাথে মিল
      default: 'pending', // default pending
    },

    note: { type: String, default: '' }, // ঐচ্ছিক মন্তব্য
  },
  { timestamps: true } // createdAt / updatedAt স্বয়ংক্রিয়ভাবে যোগ হবে
);

// একই submission-এর action গুলো সময় অনুযায়ী দ্রুত আনার জন্য compound index
staffActionSchema.index({ submissionId: 1, createdAt: -1 });

export const StaffAction = mongoose.model('StaffAction', staffActionSchema); // model export
