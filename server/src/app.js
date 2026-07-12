// ============================================================
// src/app.js
// Kaj: Express APPLICATION toiri kora (kintu listen kore NA).
//
// app.js ar server.js keno ALADA?
//   - app.js  = shudhu app object banay  -> test e import kore use kora jay
//   - server.js = port e listen kore     -> actual process
// Eita industry standard pattern. Test likhle port khulte hobe na.
// ============================================================

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import env, { isDev } from './config/env.js';
import apiRoutes from './routes/index.js';
import { globalLimiter } from './middleware/rateLimiter.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();

// ── 1. SECURITY HEADERS ──
// helmet 15+ ta HTTP header set kore (X-Frame-Options, CSP...).
// Ek line e clickjacking, MIME-sniffing er moto attack block hoy.
app.use(helmet());

// ── 2. CORS ──
// Browser default e cross-origin request block kore.
// Frontend :5173 e, backend :5000 e — alada origin. Tai explicitly allow kori.
app.use(
  cors({
    origin: env.CLIENT_ORIGIN, // '*' NA — shudhu amader frontend
    credentials: true, // cookie/auth header pathate dey
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  })
);

// ── 3. BODY PARSER ──
// JSON body ke req.body e convert kore.
// limit: 10kb -> keu 500MB JSON pathiye server RAM shesh korte parbe na (DoS)
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ── 4. LOGGING ──
// dev  = rongin, choto:  POST /api/auth/login 200 45ms
// prod = combined (Apache format) — file e redirect kora jay
app.use(morgan(isDev ? 'dev' : 'combined'));

// ── 5. RATE LIMIT (global) ──
app.use('/api', globalLimiter);

// ── 6. ROUTES ──
app.use('/api', apiRoutes);

// Root e ashle chhoto ekta info dei
app.get('/', (_req, res) => {
  res.json({
    name: 'S.O.S. (Symptom Optimized Screener) API',
    version: '0.1.0',
    docs: '/api/health',
  });
});

// ── 7. ERROR HANDLING ──
// EI DUITA SHOB SHESHE. Order ulto hole kono route-i kaj korbe na.
app.use(notFound); // kono route match kore nai -> 404
app.use(errorHandler); // shob error er final destination

export default app;
