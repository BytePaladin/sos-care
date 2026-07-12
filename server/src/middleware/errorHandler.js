// ============================================================
// src/middleware/errorHandler.js
// Kaj: PURO app er shesh safety net. Jekono error ekhane ese
//      ekta CONSISTENT JSON shape e client e jay.
//
// Express e error middleware chena jay 4 ta argument diye:
//   (err, req, res, next)  ← err first! eita bhulle Express dhorbe na.
// ============================================================

import ApiError from '../utils/ApiError.js';
import { isDev } from '../config/env.js';

/**
 * notFound — kono route match na korle ekhane ashe (404)
 * Eita errorHandler er AGE bosate hoy app.js e.
 */
export const notFound = (req, _res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

/**
 * errorHandler — shob error er final destination
 */
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, _req, res, _next) => {
  let error = err;

  // ── Mongoose er 3 dhoroner error ke amader ApiError e translate kori ──

  // 1) CastError: invalid ObjectId (jemon /api/patients/abc123)
  if (err.name === 'CastError') {
    error = ApiError.badRequest(`Invalid ${err.path}: ${err.value}`);
  }

  // 2) ValidationError: schema rule bhange (required, enum, minlength...)
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    error = ApiError.badRequest('Validation failed', messages);
  }

  // 3) Duplicate key (code 11000): unique field e same value 2 bar
  //    Jemon: same phone number diye 2 bar signup
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    error = ApiError.conflict(`An account with this ${field} already exists`);
  }

  // Jodi ekhono ApiError na hoy -> eita amader unhandled bug (500)
  if (!(error instanceof ApiError)) {
    error = new ApiError(500, err.message || 'Internal server error');
  }

  // Server console e log — production e shudhu 5xx log kori (noise komabe)
  if (error.statusCode >= 500 || isDev) {
    console.error(`[error] ${error.statusCode} ${error.message}`);
    if (isDev) console.error(err.stack);
  }

  // ── Consistent response shape — frontend eita expect korbe ──
  res.status(error.statusCode).json({
    success: false,
    message: error.message,
    errors: error.errors.length > 0 ? error.errors : undefined,
    // Stack trace SHUDHU development e — production e leak korle
    // attacker file path / library version jene jabe
    stack: isDev ? err.stack : undefined,
  });
};
