import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { PatientTriage } from '../models/PatientTriage.js';
import { ChatSession } from '../models/ChatSession.js';
import { StaffAction } from '../models/StaffAction.js';

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'sos-care-secret-key-2026', {
    expiresIn: '24h',
  });
};

/**
 * Admin Login - Requires role === 'admin'
 */
export const adminLogin = async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ message: 'Phone number and password are required' });
    }

    const user = await User.findOne({ phone: phone.trim() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid admin credentials' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied: Not an administrator account' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid admin credentials' });
    }

    res.json({
      _id: user._id,
      id: user._id.toString(),
      name: user.name,
      phone: user.phone,
      role: user.role,
      staffRole: user.staffRole || 'Hospital Administrator',
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Create a new staff account (Doctor / Nurse / Triage Specialist)
 */
export const createStaffAccount = async (req, res) => {
  try {
    const { name, phone, password, staffRole } = req.body;

    if (!name || !phone || !password || !staffRole) {
      return res.status(400).json({ message: 'Name, phone, password, and staff role are required' });
    }

    const userExists = await User.findOne({ phone: phone.trim() });
    if (userExists) {
      return res.status(400).json({ message: 'User with this phone number already exists' });
    }

    const newStaff = await User.create({
      name: name.trim(),
      phone: phone.trim(),
      password,
      role: 'staff',
      staffRole: staffRole.trim(),
    });

    res.status(201).json({
      _id: newStaff._id,
      id: newStaff._id.toString(),
      name: newStaff.name,
      phone: newStaff.phone,
      role: newStaff.role,
      staffRole: newStaff.staffRole,
      createdAt: newStaff.createdAt,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get all user accounts (Patients, Staff, Admins)
 */
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Delete a user account (Patient or Staff)
 */
export const deleteUserAccount = async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent admin from deleting themselves
    if (req.user._id.toString() === id) {
      return res.status(400).json({ message: 'You cannot delete your own admin account' });
    }

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return res.status(404).json({ message: 'Account not found' });
    }

    await User.findByIdAndDelete(id);
    res.json({ message: `Account for ${targetUser.name} (${targetUser.role}) deleted successfully` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get overall SOS-CARE Kidney Hospital Analytics
 */
export const getHospitalAnalytics = async (req, res) => {
  try {
    const totalPatients = await User.countDocuments({ role: 'patient' });
    const totalStaff = await User.countDocuments({ role: 'staff' });
    const totalAdmins = await User.countDocuments({ role: 'admin' });

    const totalScreenings = await PatientTriage.countDocuments({});
    const redAlerts = await PatientTriage.countDocuments({ category: 'red' });
    const yellowPriority = await PatientTriage.countDocuments({ category: 'yellow' });
    const greenRoutine = await PatientTriage.countDocuments({ category: 'green' });

    const pendingReviews = await PatientTriage.countDocuments({ reviewStatus: 'pending' });
    const contactedPatients = await PatientTriage.countDocuments({ reviewStatus: 'contacted' });
    const falsePositives = await PatientTriage.countDocuments({ reviewStatus: 'false_positive' });
    const needsReview = await PatientTriage.countDocuments({ reviewStatus: 'needs_review' });

    const totalChatSessions = await ChatSession.countDocuments({});
    const totalStaffActions = await StaffAction.countDocuments({});

    res.json({
      users: {
        totalPatients,
        totalStaff,
        totalAdmins,
        totalUsers: totalPatients + totalStaff + totalAdmins,
      },
      screenings: {
        totalScreenings,
        redAlerts,
        yellowPriority,
        greenRoutine,
      },
      triageQueue: {
        pendingReviews,
        contactedPatients,
        falsePositives,
        needsReview,
      },
      sessions: {
        totalChatSessions,
      },
      audit: {
        totalStaffActions,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get analytics per staff member
 */
export const getStaffAnalytics = async (req, res) => {
  try {
    const staffMembers = await User.find({ role: 'staff' }).select('-password');
    const triages = await PatientTriage.find({});
    const actions = await StaffAction.find({});

    const analytics = staffMembers.map((staff) => {
      const staffIdStr = staff._id.toString();

      // Count patient files reviewed by this doctor
      const reviewedCount = triages.filter(
        (t) => t.reviewedBy && t.reviewedBy.toString() === staffIdStr
      ).length;

      // Count patient files forwarded to this doctor
      const forwardedToCount = triages.filter(
        (t) => t.forwardedTo && t.forwardedTo.toString() === staffIdStr
      ).length;

      // Count audit actions logged for this doctor
      const actionsLogged = actions.filter(
        (a) => a.staffId && a.staffId.toString() === staffIdStr
      ).length;

      return {
        _id: staff._id,
        name: staff.name,
        phone: staff.phone,
        staffRole: staff.staffRole || 'Medical Staff',
        telegramOptIn: staff.telegramOptIn,
        reviewedCount,
        forwardedToCount,
        actionsLogged,
        joinedAt: staff.createdAt,
      };
    });

    res.json(analytics);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get full staff activity audit trail
 */
export const getStaffActions = async (req, res) => {
  try {
    const actions = await StaffAction.find({})
      .populate('submissionId', 'patientName patientPhone category reviewStatus')
      .populate('staffId', 'name staffRole phone')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json(actions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
