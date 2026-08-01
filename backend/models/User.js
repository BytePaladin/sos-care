const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    full_name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone_number: { type: String },
    password_hash: { type: String, required: true },
    role: { type: String, enum: ['PATIENT', 'DOCTOR', 'NURSE', 'ADMIN'], default: 'PATIENT' },
    created_at: { type: Date, default: Date.now }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password_hash')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password_hash = await bcrypt.hash(this.password_hash, salt);
    next();
});

module.exports = mongoose.model('User', userSchema);
