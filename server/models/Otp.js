import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema({
  email: { type: String, required: true, index: true },
  otp: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 180 } // Automatically deleted by MongoDB after 3 mins
});

export const Otp = mongoose.models.Otp || mongoose.model('Otp', otpSchema);
