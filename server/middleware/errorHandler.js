/**
 * errorHandler.js
 * অচেনা route এবং সব ধরনের server error একই format-এ সামলানোর middleware.
 * এতে frontend সব সময় { message: "..." } আকারে error পায়.
 */

// কোনো route না মিললে এখানে এসে 404 তৈরি হবে
export const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`); // কোন route মেলেনি তা লেখা
  error.statusCode = 404; // HTTP status বসানো
  next(error); // errorHandler-এ পাঠিয়ে দেওয়া
};

// সব error শেষ পর্যন্ত এখানে এসে JSON হয়ে ফেরত যায়
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  // Mongoose-এর invalid ObjectId হলে সেটি আসলে 404, 500 নয়
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    return res.status(404).json({ message: 'Resource not found (invalid id)' }); // পরিষ্কার বার্তা
  }

  // Mongoose validation error হলে 400 দেওয়া উচিত
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map((e) => e.message); // সব field-এর বার্তা
    return res.status(400).json({ message: 'Validation failed', details }); // details সহ ফেরত
  }

  // duplicate key (যেমন একই phone দুইবার) হলে 409 Conflict
  if (err.code === 11000) {
    return res.status(409).json({ message: 'Duplicate value: this record already exists' });
  }

  // status নির্ধারণ: error-এ statusCode থাকলে সেটি, নাহলে response-এর status, নাহলে 500
  const statusCode = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);
  console.error(`[Error] ${req.method} ${req.originalUrl} → ${err.message}`); // server log-এ রাখা

  res.status(statusCode).json({
    message: err.message || 'Internal Server Error', // frontend-এ দেখানোর বার্তা
    // production-এ stack trace লুকানো হয়, development-এ debug-এর জন্য দেখানো হয়
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
};
