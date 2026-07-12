// ============================================================
// src/models/Notification.js
// ER Diagram: NOTIFICATIONS entity
// Kaj: RED case elei doctor/nurse ke alert kora.
// Ekhon polling (frontend prottek 30s e GET korbe).
// Bhobisshot e Socket.IO diye real-time kora jabe — schema same thakbe.
// ============================================================

import mongoose from 'mongoose';

// ER diagram: [NEW_RED_ALERT | ASSIGNED | STATUS_UPDATE | OTHER]
const NOTIFICATION_TYPE_ENUM = ['NEW_RED_ALERT', 'ASSIGNED', 'STATUS_UPDATE', 'OTHER'];

const notificationSchema = new mongoose.Schema(
  {
    // Kon submission er jonno alert — FK
    submissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Submission',
      required: true,
    },

    // Kake alert pathano hocche — FK to STAFF
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      required: true,
      index: true,
    },

    notificationType: {
      type: String,
      enum: NOTIFICATION_TYPE_ENUM,
      default: 'OTHER',
    },

    // Doctor ta porechhe kina
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// "Amar koyta unread notification?" — ei query ta bar bar cholbe, tai index
notificationSchema.index({ staffId: 1, isRead: 1, createdAt: -1 });

export { NOTIFICATION_TYPE_ENUM };

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
