// ============================================================
// src/middleware/auth.js
// Project er SECURITY GATE. Duita middleware:
//
//   protect()            -> "Tumi ke?"      (Authentication)
//   authorize(...roles)  -> "Tumi ki parbe?" (Authorization)
//
// Duita ALADA jinish. Ek jon logged-in NURSE (authenticated) hote pare,
// kintu patient delete korar permission (authorized) nao thakte pare.
// ============================================================

import { verifyToken } from '../utils/generateToken.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import Patient from '../models/Patient.js';
import Staff from '../models/Staff.js';

/**
 * protect — Authentication middleware
 * Header theke Bearer token ney, verify kore, req.user set kore dey.
 * Ei middleware er por-er controller gulo req.user use korte parbe.
 */
export const protect = asyncHandler(async (req, _res, next) => {
  let token;

  // Standard format:  Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    // 'Bearer ' (7 character) er por theke token ta kete nei
    token = authHeader.split(' ')[1];
  }

  // Token-i nai -> 401 Unauthorized
  if (!token) {
    throw ApiError.unauthorized('Not authorized — no token provided');
  }

  let decoded;
  try {
    // Signature verify + expiry check — duita-i ek sathe hoy
    decoded = verifyToken(token);
  } catch (err) {
    // TokenExpiredError vs JsonWebTokenError — alada message dile
    // frontend bujhbe re-login korabe na refresh korabe
    if (err.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Session expired — please log in again');
    }
    throw ApiError.unauthorized('Not authorized — invalid token');
  }

  // ── IMPORTANT: token valid mane user ekhono ache eta na ──
  // Token issue howar por admin account ta delete/deactivate korte pare.
  // Tai prottek request e DB theke fresh kore user ta ene check kori.
  let user;

  if (decoded.role === 'PATIENT') {
    user = await Patient.findById(decoded.id);
  } else {
    // DOCTOR | NURSE | ADMIN — shob Staff collection e
    user = await Staff.findById(decoded.id);
  }

  if (!user) {
    throw ApiError.unauthorized('The user belonging to this token no longer exists');
  }

  if (!user.isActive) {
    throw ApiError.forbidden('This account has been deactivated');
  }

  // req.user set — ekhon theke jekono controller e paoya jabe
  req.user = user;
  req.userRole = decoded.role;

  next(); // porer middleware / controller e jao
});

/**
 * authorize — Authorization middleware (role-based access control)
 * Use: router.get('/queue', protect, authorize('DOCTOR', 'NURSE'), getQueue)
 *
 * Note: eita ekta HIGHER-ORDER function. authorize('DOCTOR') call korle
 * eita ekta middleware function RETURN kore — Express seta use kore.
 */
export const authorize = (...allowedRoles) => {
  return (req, _res, next) => {
    // protect() age chalate hobe — na hole req.userRole thakbe na
    if (!req.userRole) {
      return next(ApiError.unauthorized('Not authorized — protect() must run first'));
    }

    // User er role allowed list e ache kina
    if (!allowedRoles.includes(req.userRole)) {
      return next(
        ApiError.forbidden(
          `Role '${req.userRole}' is not allowed to access this resource`
        )
      );
    }

    next(); // permission ache — egiye jao
  };
};

/**
 * requireVerified — OTP verify na kora patient ke block kore.
 * Patient signup korlo kintu OTP dilo na -> symptom submit korte parbe na.
 */
export const requireVerified = (req, _res, next) => {
  if (req.userRole === 'PATIENT' && !req.user.isVerified) {
    return next(ApiError.forbidden('Please verify your phone number first'));
  }
  next();
};
