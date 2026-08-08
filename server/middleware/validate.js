/**
 * validate.js
 * Lightweight middleware to validate Request body / param.
 * Does not require external validation packages — keeping project costs zero.
 */

import mongoose from 'mongoose'; // for validating ObjectId

/**
 * Checks if specific fields exist in the body.
 * @param {string[]} fields — required fields
 */
export const requireFields = (fields) => (req, res, next) => {
  // create list of missing or empty fields
  const missing = fields.filter((field) => {
    const value = req.body?.[field]; // get value from body
    return value === undefined || value === null || String(value).trim() === ''; // check if empty
  });

  // stop and return 400 if any field is missing
  if (missing.length > 0) {
    return res.status(400).json({
      message: `Missing required field(s): ${missing.join(', ')}`, // notify which are missing
    });
  }

  next(); // proceed to next middleware if all good
};

/**
 * Checks if the id in URL param is a valid MongoDB ObjectId.
 * @param {string} paramName — name of param, default 'id'
 */
export const validateObjectId = (paramName = 'id') => (req, res, next) => {
  const value = req.params[paramName]; // get id from param

  // 400 if not a valid ObjectId — saves a DB query
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return res.status(400).json({ message: `Invalid ${paramName} format` }); // clear message
  }

  next(); // proceed if valid
};

/**
 * Controls the maximum length of message text (to prevent huge payloads).
 * @param {string} field — which field to check
 * @param {number} max — maximum character count
 */
export const maxLength = (field, max = 2000) => (req, res, next) => {
  const value = req.body?.[field]; // get value from body

  // return 400 if value exists and exceeds limit
  if (typeof value === 'string' && value.length > max) {
    return res.status(400).json({ message: `${field} must be ${max} characters or fewer` });
  }

  next(); // proceed if within limit
};
