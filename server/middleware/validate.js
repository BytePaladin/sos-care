/**
 * validate.js
 * Request body / param যাচাই করার হালকা middleware.
 * বাইরের কোনো validation package লাগছে না — তাই প্রজেক্টের খরচ শূন্যই থাকছে.
 */

import mongoose from 'mongoose'; // ObjectId যাচাই করার জন্য

/**
 * নির্দিষ্ট field গুলো body-তে আছে কিনা তা যাচাই করে.
 * @param {string[]} fields — যেসব field অবশ্যই লাগবে
 */
export const requireFields = (fields) => (req, res, next) => {
  // যেসব field অনুপস্থিত বা ফাঁকা সেগুলোর তালিকা তৈরি
  const missing = fields.filter((field) => {
    const value = req.body?.[field]; // body থেকে মান নেওয়া
    return value === undefined || value === null || String(value).trim() === ''; // ফাঁকা কিনা যাচাই
  });

  // একটিও অনুপস্থিত থাকলে 400 দিয়ে থামিয়ে দেওয়া হয়
  if (missing.length > 0) {
    return res.status(400).json({
      message: `Missing required field(s): ${missing.join(', ')}`, // কোনগুলো নেই তা জানানো
    });
  }

  next(); // সব ঠিক থাকলে পরবর্তী middleware
};

/**
 * URL param-এ থাকা id বৈধ MongoDB ObjectId কিনা তা যাচাই করে.
 * @param {string} paramName — param এর নাম, default 'id'
 */
export const validateObjectId = (paramName = 'id') => (req, res, next) => {
  const value = req.params[paramName]; // param থেকে id নেওয়া

  // ObjectId হিসেবে বৈধ না হলে 400 — এতে DB query-ই করতে হয় না
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return res.status(400).json({ message: `Invalid ${paramName} format` }); // পরিষ্কার বার্তা
  }

  next(); // বৈধ হলে এগিয়ে যাওয়া
};

/**
 * message text-এর দৈর্ঘ্য সীমা নিয়ন্ত্রণ করে (খুব বড় payload ঠেকাতে).
 * @param {string} field — কোন field দেখতে হবে
 * @param {number} max — সর্বোচ্চ character সংখ্যা
 */
export const maxLength = (field, max = 2000) => (req, res, next) => {
  const value = req.body?.[field]; // body থেকে মান নেওয়া

  // মান থাকলে এবং সীমা ছাড়ালে 400 ফেরত
  if (typeof value === 'string' && value.length > max) {
    return res.status(400).json({ message: `${field} must be ${max} characters or fewer` });
  }

  next(); // সীমার মধ্যে থাকলে এগিয়ে যাওয়া
};
