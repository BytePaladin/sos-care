// ============================================================
// src/middleware/validate.js
// Kaj: express-validator er result check kore.
//
// Golden rule: NEVER TRUST CLIENT INPUT.
// Frontend e password strength check ache — kintu keu Postman diye
// direct API te "123" pathiye dite pare. Tai SERVER e-o check korte hobe.
// ============================================================

import { validationResult } from 'express-validator';
import ApiError from '../utils/ApiError.js';

/**
 * validate — validation chain er por bosbe.
 * Use: router.post('/register', registerRules, validate, registerPatient)
 */
export const validate = (req, _res, next) => {
  // Age chola validator chain gulo je error rekheche, seta tuli
  const result = validationResult(req);

  if (result.isEmpty()) return next(); // kono error nai — egiye jao

  // Error gulo ke porar moto string e convert kori
  const messages = result.array().map((e) => `${e.path}: ${e.msg}`);

  // 400 Bad Request — client er pathano data thik nai
  next(ApiError.badRequest('Validation failed', messages));
};

export default validate;
