/**
 * auth.js
 * JWT ভিত্তিক authentication ও role-based access control.
 * Week 3 update: optionalAuth এবং ownership guard যোগ করা হয়েছে.
 */

import jwt from 'jsonwebtoken'; // token verify করার জন্য
import { User } from '../models/User.js'; // token থেকে পাওয়া id দিয়ে user আনতে

// JWT secret এক জায়গা থেকে নেওয়া হচ্ছে যাতে সব ফাইলে একই মান থাকে
const JWT_SECRET = process.env.JWT_SECRET || 'sos-care-secret-key-2026';

/**
 * Authorization header থেকে Bearer token আলাদা করে ফেরত দেয়.
 * token না থাকলে null.
 */
const extractToken = (req) => {
  const header = req.headers.authorization; // "Bearer <token>" আশা করছি
  if (!header || !header.startsWith('Bearer ')) return null; // ঠিক format না হলে null
  const token = header.split(' ')[1]; // space দিয়ে ভেঙে দ্বিতীয় অংশ নেওয়া
  return token && token.trim() ? token.trim() : null; // ফাঁকা হলে null
};

/**
 * protect — এই route ব্যবহার করতে অবশ্যই login লাগবে.
 */
export const protect = async (req, res, next) => {
  const token = extractToken(req); // header থেকে token বের করা

  // token একেবারেই না থাকলে 401
  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET); // signature ও মেয়াদ যাচাই
    const user = await User.findById(decoded.id).select('-password'); // password ছাড়া user আনা

    // token বৈধ কিন্তু user মুছে ফেলা হয়েছে — তখনও 401
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = user; // পরবর্তী middleware/controller-এ ব্যবহারের জন্য বসানো
    return next(); // এগিয়ে যাওয়া
  } catch (error) {
    // মেয়াদ শেষ হলে আলাদা বার্তা দিলে frontend সহজে বুঝতে পারে
    const message =
      error.name === 'TokenExpiredError' ? 'Session expired, please log in again' : 'Not authorized, token failed';
    return res.status(401).json({ message });
  }
};

/**
 * optionalAuth — token থাকলে user বসাবে, না থাকলেও request আটকাবে না.
 * anonymous রোগীর screening চালু রাখার জন্য দরকার.
 */
export const optionalAuth = async (req, res, next) => {
  const token = extractToken(req); // token আছে কিনা দেখা

  // token না থাকলে anonymous হিসেবেই এগিয়ে যাবে
  if (!token) {
    req.user = null; // স্পষ্টভাবে null বসানো হচ্ছে
    return next(); // request বন্ধ হচ্ছে না
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET); // token যাচাই
    req.user = await User.findById(decoded.id).select('-password'); // user বসানো
  } catch {
    req.user = null; // token নষ্ট হলেও anonymous হিসেবে চলবে
  }

  return next(); // দুই ক্ষেত্রেই এগিয়ে যাওয়া
};

/**
 * requireStaff — শুধু staff (doctor / nurse / admin) এই route ব্যবহার করতে পারবে.
 */
export const requireStaff = (req, res, next) => {
  // user আছে এবং role staff হলে অনুমতি
  if (req.user && req.user.role === 'staff') {
    return next(); // অনুমতি দেওয়া হলো
  }

  return res.status(403).json({ message: 'Access denied: Staff privileges required' }); // নাহলে 403
};

/**
 * allowOwnerOrStaff — একটি resource-এর মালিক অথবা staff হলেই অনুমতি.
 * @param {Function} getOwnerId — resource থেকে owner id বের করার function
 */
export const allowOwnerOrStaff = (getOwnerId) => (req, res, next) => {
  const ownerId = getOwnerId(req); // resource-এর owner id নেওয়া

  // resource-এর কোনো owner না থাকলে (anonymous session) সবাই ব্যবহার করতে পারবে
  if (!ownerId) return next(); // anonymous flow চালু রাখা

  // staff হলে সব record দেখার অনুমতি আছে
  if (req.user && req.user.role === 'staff') return next(); // staff bypass

  // মালিক নিজে হলে অনুমতি
  if (req.user && req.user._id.toString() === ownerId.toString()) return next(); // owner ok

  return res.status(403).json({ message: 'Access denied: you do not own this resource' }); // অন্য কেউ হলে 403
};
