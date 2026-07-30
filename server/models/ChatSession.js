import mongoose from 'mongoose';

const chatSessionSchema = new mongoose.Schema(
  {
    triageId: { type: mongoose.Schema.Types.ObjectId, ref: 'PatientTriage', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    title: { type: String, default: 'Symptom Screening Session' },
    status: { type: String, enum: ['active', 'completed', 'flagged_red'], default: 'active' },

    // Conversation messages exchange
    messages: [
      {
        sender: { type: String, enum: ['user', 'bot', 'staff', 'system'], required: true },
        text: { type: String, required: true },
        metadata: { type: Object, default: {} },
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

export const ChatSession = mongoose.model('ChatSession', chatSessionSchema);
