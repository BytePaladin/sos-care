/**
 * errorHandler.js
 * Middleware to handle unknown routes and all types of server errors in the same format.
 * Ensures frontend always receives errors as { message: "..." }.
 */

// 404 is generated here if no route is matched
export const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`); // log unmatched route
  error.statusCode = 404; // set HTTP status
  next(error); // pass to errorHandler
};

// All errors eventually arrive here and are returned as JSON
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  // Invalid ObjectId from Mongoose is a 404, not a 500
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    return res.status(404).json({ message: 'Resource not found (invalid id)' }); // clear message
  }

  // Mongoose validation error should be 400
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map((e) => e.message); // messages for all fields
    return res.status(400).json({ message: 'Validation failed', details }); // return with details
  }

  // Duplicate key (e.g. same phone twice) is 409 Conflict
  if (err.code === 11000) {
    return res.status(409).json({ message: 'Duplicate value: this record already exists' });
  }

  // Determine status: statusCode from error if available, else response status, else 500
  const statusCode = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);
  console.error(`[Error] ${req.method} ${req.originalUrl} → ${err.message}`); // log in server

  res.status(statusCode).json({
    message: err.message || 'Internal Server Error', // message to show in frontend
    // Hide stack trace in production, show for debugging in development
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
};
