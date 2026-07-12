// ============================================================
// src/utils/generateToken.js
// Kaj: JWT (JSON Web Token) toiri kora.
//
// JWT er 3 ta ongsho, dot diye alada:  header.payload.signature
//   header    -> kon algorithm (HS256)
//   payload   -> amader data (id, role)  ← eita ENCRYPTED NA, shudhu base64!
//   signature -> JWT_SECRET diye sign kora — tamper korle mismatch hobe
//
// TAI: payload e KOKHONO password/sensitive data rakhbo na.
//      Shudhu id + role — ja diye DB theke baki data ana jay.
// ============================================================

import jwt from 'jsonwebtoken';
import env from '../config/env.js';

/**
 * @param {string} id   - Mongo _id (patient ba staff)
 * @param {string} role - PATIENT | DOCTOR | NURSE | ADMIN
 * @returns {string} signed JWT
 */
export const generateToken = (id, role) => {
  return jwt.sign(
    { id, role }, // payload — chhoto rakha bhalo, prottek request e jay
    env.JWT_SECRET, // gopon key — eita leak hole je keu token banate parbe
    { expiresIn: env.JWT_EXPIRES_IN } // 7d por token ar kaj korbe na
  );
};

/**
 * Token verify kore payload return kore. Invalid/expired hole throw kore.
 */
export const verifyToken = (token) => {
  return jwt.verify(token, env.JWT_SECRET);
};

export default generateToken;
