/**
 * auth.js
 * JWT based authentication and role-based access control.
 * Week 3 update: optionalAuth and ownership guard added.
 */

import jwt from 'jsonwebtoken'; // for token verification
import { User } from '../models/User.js'; // fetch user using id from token

// JWT secret is taken from one place so all files have the same value
const JWT_SECRET = process.env.JWT_SECRET || 'sos-care-secret-key-2026';

/**
 * Extracts Bearer token from Authorization header.
 * Returns null if token is not found.
 */
const extractToken = (req) => {
  const header = req.headers.authorization; // expecting "Bearer <token>"
  if (!header || !header.startsWith('Bearer ')) return null; // null if format is incorrect
  const token = header.split(' ')[1]; // take the second part split by space
  return token && token.trim() ? token.trim() : null; // null if empty
};

/**
 * protect — login is required to use this route.
 */
export const protect = async (req, res, next) => {
  const token = extractToken(req); // extract token from header

  // 401 if token is completely missing
  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET); // verify signature and expiration
    const user = await User.findById(decoded.id).select('-password'); // fetch user without password

    // 401 if token is valid but user is deleted
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = user; // set for use in next middleware/controller
    return next(); // proceed
  } catch (error) {
    // providing a specific message for expiration helps frontend
    const message =
      error.name === 'TokenExpiredError' ? 'Session expired, please log in again' : 'Not authorized, token failed';
    return res.status(401).json({ message });
  }
};

/**
 * optionalAuth — sets user if token exists, otherwise doesn't block request.
 * Needed for anonymous patient screening.
 */
export const optionalAuth = async (req, res, next) => {
  const token = extractToken(req); // check if token exists

  // proceed as anonymous if no token
  if (!token) {
    req.user = null; // explicitly set to null
    return next(); // request is not blocked
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET); // verify token
    req.user = await User.findById(decoded.id).select('-password'); // set user
  } catch {
    req.user = null; // proceed as anonymous if token is invalid
  }

  return next(); // proceed in both cases
};

/**
 * requireStaff — only staff (doctor / nurse / admin) can use this route.
 */
export const requireStaff = (req, res, next) => {
  // allow if user exists and role is staff or admin
  if (req.user && (req.user.role === 'staff' || req.user.role === 'admin')) {
    return next(); // permission granted
  }

  return res.status(403).json({ message: 'Access denied: Staff privileges required' }); // 403 otherwise
};

/**
 * requireAdmin — only hospital admin can use this route.
 */
export const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ message: 'Access denied: Administrator privileges required' });
};

/**
 * allowOwnerOrStaff — allow if owner of a resource or staff.
 * @param {Function} getOwnerId — function to extract owner id from resource
 */
export const allowOwnerOrStaff = (getOwnerId) => (req, res, next) => {
  const ownerId = getOwnerId(req); // get owner id of resource

  // allow everyone if resource has no owner (anonymous session)
  if (!ownerId) return next(); // keep anonymous flow running

  // staff has permission to view all records
  if (req.user && req.user.role === 'staff') return next(); // staff bypass

  // allow if owner themselves
  if (req.user && req.user._id.toString() === ownerId.toString()) return next(); // owner ok

  return res.status(403).json({ message: 'Access denied: you do not own this resource' }); // 403 for others
};
