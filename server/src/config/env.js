// ============================================================
// src/config/env.js
// Kaj: .env file theke shob environment variable load kore,
//      validate kore, ekta single object hisebe export kore.
// Keno: process.env.X direct use korle typo dhora pore na.
//       Ekhane fail-fast korle server boot-er shomoy-i bujhbo.
// ============================================================

import dotenv from 'dotenv';

// .env file ta memory te load kore (process.env bhorti kore)
dotenv.config();

// Jei variable gulo chhara server chalano-i uchit na
const REQUIRED_VARS = ['MONGO_URI', 'JWT_SECRET'];

// Prottek required variable ache kina check kori
const missing = REQUIRED_VARS.filter((key) => !process.env[key]);

// Jodi kono ekta o missing thake -> server boot hobei na (fail-fast)
if (missing.length > 0) {
  console.error('[env] FATAL: Missing required environment variables:');
  missing.forEach((key) => console.error(`        - ${key}`));
  console.error('[env] Fix: copy .env.example to .env and fill the values.');
  process.exit(1); // exit code 1 = error diye process bondho
}

// JWT secret khub choto hole brute-force kora shohoj -> guard rakhi
if (process.env.JWT_SECRET.length < 32) {
  console.error('[env] FATAL: JWT_SECRET must be at least 32 characters long.');
  process.exit(1);
}

// Shob config ek jaygay, freeze kore rakhi jate keu accidentally change korte na pare
const env = Object.freeze({
  // Server kon port e chalbe (default 5000)
  PORT: Number(process.env.PORT) || 5000,

  // development | production — logging o error detail ekhane depend kore
  NODE_ENV: process.env.NODE_ENV || 'development',

  // MongoDB Atlas connection string
  MONGO_URI: process.env.MONGO_URI,

  // JWT sign korar gopon key
  JWT_SECRET: process.env.JWT_SECRET,

  // Token koto din por expire hobe
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  // bcrypt salt rounds — beshi hole secure kintu slow (10 = balanced)
  BCRYPT_SALT_ROUNDS: Number(process.env.BCRYPT_SALT_ROUNDS) || 10,

  // OTP koto minute porjonto valid thakbe
  OTP_TTL_MINUTES: Number(process.env.OTP_TTL_MINUTES) || 5,

  // React frontend kon origin theke asbe (CORS er jonno)
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
});

// Chhoto helper: development mode kina bolar shortcut
export const isDev = env.NODE_ENV === 'development';

export default env;
