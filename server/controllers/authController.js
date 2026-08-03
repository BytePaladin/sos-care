import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'sos-care-secret-key-2026', {
    expiresIn: '24h',
  });
};

export const loginUser = async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ message: 'Phone number and password are required' });
    }

    const cleanPhone = phone.trim();
    let user = await User.findOne({ phone: cleanPhone });

    // Auto-seed demo accounts on demand if not present in DB
    if (!user) {
      if (cleanPhone === '01700000000' && (password === 'Demo@1234' || password === 'password123')) {
        user = await User.create({
          name: 'Kamrul Hasan',
          phone: '01700000000',
          password: 'Demo@1234',
          role: 'patient',
        });
      } else if (cleanPhone === '01800000000' && (password === 'Staff@1234' || password === 'password123')) {
        user = await User.create({
          name: 'Dr. Nusrat Jahan',
          phone: '01800000000',
          password: 'Staff@1234',
          role: 'staff',
          staffRole: 'Chief Nephrologist',
          telegramChatId: process.env.VITE_TELEGRAM_CHAT_ID || '6116969946',
          telegramOptIn: true,
        });
      } else if (cleanPhone === '01900000000' && (password === 'Staff@1234' || password === 'password123')) {
        user = await User.create({
          name: 'Dr. Tanvir Ahmed',
          phone: '01900000000',
          password: 'Staff@1234',
          role: 'staff',
          staffRole: 'Resident Physician',
          telegramChatId: '',
          telegramOptIn: false,
        });
      }
    }

    if (user && (await user.matchPassword(password))) {
      return res.json({
        _id: user._id,
        id: user._id.toString(),
        name: user.name,
        phone: user.phone,
        role: user.role,
        staffRole: user.staffRole,
        telegramChatId: user.telegramChatId,
        telegramOptIn: user.telegramOptIn,
        token: generateToken(user._id),
      });
    }

    // Support Demo@1234 / Staff@1234 sync if DB had legacy password for demo accounts
    if (user && (
      (cleanPhone === '01700000000' && (password === 'Demo@1234' || password === 'password123')) ||
      (cleanPhone === '01800000000' && (password === 'Staff@1234' || password === 'password123')) ||
      (cleanPhone === '01900000000' && (password === 'Staff@1234' || password === 'password123'))
    )) {
      user.password = password;
      await user.save();
      return res.json({
        _id: user._id,
        id: user._id.toString(),
        name: user.name,
        phone: user.phone,
        role: user.role,
        staffRole: user.staffRole,
        telegramChatId: user.telegramChatId,
        telegramOptIn: user.telegramOptIn,
        token: generateToken(user._id),
      });
    }

    res.status(401).json({ message: 'Invalid phone number or password' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const registerPatient = async (req, res) => {
  try {
    const { name, phone, password } = req.body;

    if (!name || !phone || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const userExists = await User.findOne({ phone: phone.trim() });
    if (userExists) {
      return res.status(400).json({ message: 'User with this phone number already exists' });
    }

    const user = await User.create({
      name: name.trim(),
      phone: phone.trim(),
      password,
      role: 'patient',
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        id: user._id.toString(),
        name: user.name,
        phone: user.phone,
        role: user.role,
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateTelegramSettings = async (req, res) => {
  try {
    const { telegramOptIn, telegramChatId } = req.body;
    const user = await User.findById(req.user._id);

    if (user) {
      user.telegramOptIn = telegramOptIn !== undefined ? telegramOptIn : user.telegramOptIn;
      user.telegramChatId = telegramChatId !== undefined ? telegramChatId : user.telegramChatId;

      const updatedUser = await user.save();
      res.json({
        _id: updatedUser._id,
        id: updatedUser._id.toString(),
        name: updatedUser.name,
        phone: updatedUser.phone,
        role: updatedUser.role,
        staffRole: updatedUser.staffRole,
        telegramChatId: updatedUser.telegramChatId,
        telegramOptIn: updatedUser.telegramOptIn,
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getStaffMembers = async (req, res) => {
  try {
    const staff = await User.find({ role: 'staff' }).select('-password');
    res.json(
      staff.map((s) => ({
        _id: s._id,
        id: s._id.toString(),
        name: s.name,
        role: s.staffRole || 'Medical Staff',
        phone: s.phone,
      }))
    );
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
