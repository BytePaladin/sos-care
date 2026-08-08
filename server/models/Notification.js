/**
 * Notification.js
 * --------------------------------------------------------------------------
 * Week 5: the NOTIFICATIONS collection from the proposal's ER diagram.
 *
 * Until now a Red case was only visible if a staff member happened to be
 * looking at the dashboard. This collection makes the alert a stored fact
 * owned by the backend rather than a transient UI state, so it survives a
 * page refresh, a logout, or a browser crash.
 *
 * One document = one alert for one staff member. A single Red case therefore
 * produces several documents (one per recipient), which is what allows each
 * staff member to have their own read/unread state.
 * --------------------------------------------------------------------------
 */

import mongoose from 'mongoose';

// Notification types — matches notification_type in the ER diagram
export const NOTIFICATION_TYPES = ['NEW_RED_ALERT', 'ASSIGNED', 'STATUS_UPDATE', 'SEVERITY_OVERRIDE', 'OTHER'];

const notificationSchema = new mongoose.Schema(
  {
    // which triage record this alert is about
    submissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PatientTriage',
      required: true,
      index: true,
    },

    // which staff member this copy belongs to (the recipient)
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    notificationType: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
    },

    // short human-readable line the dashboard can show without another query
    title: { type: String, required: true },
    body: { type: String, default: '' },

    // severity is denormalised so the bell icon can be colour-coded
    // without joining back to PatientTriage on every poll
    severity: {
      type: String,
      enum: ['red', 'yellow', 'green'],
      default: 'red',
      index: true,
    },

    // patient name is copied for the same reason — the alert stays readable
    // even if the triage record is later cleared by an admin
    patientName: { type: String, default: '' },

    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// The dashboard's main query is "my unread alerts, newest first"
notificationSchema.index({ staffId: 1, isRead: 1, createdAt: -1 });

// Used by the de-duplication check in notificationService
notificationSchema.index({ submissionId: 1, staffId: 1, notificationType: 1 });

export const Notification = mongoose.model('Notification', notificationSchema);
