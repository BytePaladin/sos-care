// ============================================================
// src/utils/ApiError.js
// Kaj: Custom Error class — jekhane HTTP status code o thake.
// Keno: throw new Error('not found') e status code thake na,
//       tai errorHandler bujhte pare na 404 na 500 pathabe.
// ============================================================

class ApiError extends Error {
  /**
   * @param {number} statusCode - HTTP status (400, 401, 404, 409, 500...)
   * @param {string} message    - Client ke ja bolbo
   * @param {Array}  errors     - Validation error er list (optional)
   */
  constructor(statusCode, message, errors = []) {
    super(message); // parent Error class er constructor call kori

    this.statusCode = statusCode;
    this.errors = errors;

    // 4xx = client er dosh (operational), 5xx = amader dosh (bug)
    this.isOperational = statusCode < 500;

    // Stack trace theke ei constructor ta baad dey — clean trace pai
    Error.captureStackTrace(this, this.constructor);
  }

  // ── Shortcut factory methods — controller e likhte shohoj hoy ──
  static badRequest(msg = 'Bad request', errors = []) {
    return new ApiError(400, msg, errors);
  }

  static unauthorized(msg = 'Not authorized') {
    return new ApiError(401, msg);
  }

  static forbidden(msg = 'Access forbidden') {
    return new ApiError(403, msg);
  }

  static notFound(msg = 'Resource not found') {
    return new ApiError(404, msg);
  }

  static conflict(msg = 'Resource already exists') {
    return new ApiError(409, msg);
  }

  static tooManyRequests(msg = 'Too many requests') {
    return new ApiError(429, msg);
  }
}

export default ApiError;
