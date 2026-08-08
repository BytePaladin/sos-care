/**
 * index.js — S.O.S. Care API server entry point
 * Week 3: request logger, 404 handler, centralised error handler,
 * health check and initial environment validation.
 * Week 5: notification routes mounted; health check now reports whether
 * rate limiting is active.
 * Week 6: health check also reports the ML circuit-breaker state.
 */

import express from 'express'; // web framework
import cors from 'cors'; // allow frontend calls
import dotenv from 'dotenv'; // for reading .env
import path from 'path'; // for creating paths
import { fileURLToPath } from 'url'; // to get __dirname in ESM
import { connectDB } from './config/db.js'; // MongoDB connection

import authRoutes from './routes/authRoutes.js'; // /api/auth
import triageRoutes from './routes/triageRoutes.js'; // /api/triage
import chatRoutes from './routes/chatRoutes.js'; // /api/chats
import adminRoutes from './routes/adminRoutes.js'; // /api/admin
import notificationRoutes from './routes/notificationRoutes.js'; // /api/notifications (Week 5)
import { notFound, errorHandler } from './middleware/errorHandler.js'; // error middleware
import { pingMlService, getMlBreakerState } from './services/mlClient.js'; // check if ML service is alive
import { getSafetyNetRuleTags } from './services/safetyNet.js'; // how many rules exist

const __filename = fileURLToPath(import.meta.url); // current file path
const __dirname = path.dirname(__filename); // current directory

// Load environment variables — first root .env.local, then server .env
dotenv.config({ path: path.join(__dirname, '../.env.local') }); // root override file
dotenv.config(); // server/.env

const app = express(); // express app
const PORT = process.env.PORT || 5000; // port to run on

// ── Validate essential env variables on startup — better to warn early ──
if (!process.env.JWT_SECRET) {
  console.warn('[Warn] JWT_SECRET is not set — falling back to the default dev secret.'); // must set in production
}
if (!process.env.MONGODB_URI) {
  console.warn('[Warn] MONGODB_URI is not set — falling back to local mongodb://127.0.0.1:27017/sos-care');
}

connectDB(); // start MongoDB connection

// ── Middleware ──
app.use(cors()); // allow all origins (sufficient for demo)
app.use(express.json({ limit: '1mb' })); // parse JSON body, prevent large payloads

// Disable caching for all API responses (Vercel CDN / Browser)
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  next();
});

// Log how long each request took — very useful for debugging
app.use((req, res, next) => {
  const startedAt = Date.now(); // start time
  res.on('finish', () => {
    const ms = Date.now() - startedAt; // total time
    console.log(`[API] ${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)`); // log line
  });
  next(); // next middleware
});

// ── API Routes ──
app.use('/api/auth', authRoutes); // authentication
app.use('/api/triage', triageRoutes); // staff dashboard
app.use('/api/chats', chatRoutes); // patient screening
app.use('/api/admin', adminRoutes); // admin panel
app.use('/api/notifications', notificationRoutes); // Week 5: staff notification bell

// ── Health check (including ML service and safety-net status) ──
app.get('/api/health', async (req, res) => {
  const mlAlive = await pingMlService(); // is Flask service responding

  res.json({
    status: 'OK', // server running
    message: 'S.O.S. Care API Server running', // legacy frontend checks this key
    mlService: mlAlive ? 'online' : 'offline (fallback heuristic active)', // ML status
    safetyNetRules: getSafetyNetRuleTags().length, // active critical rules count
    rateLimiting: process.env.RATE_LIMIT_DISABLED === 'true' ? 'disabled' : 'active', // Week 5
    mlBreaker: getMlBreakerState(), // Week 6: is the ML circuit breaker open
    timestamp: new Date().toISOString(), // time
  });
});

// ── Error handling (must be placed after all routes) ──
app.use(notFound); // 404 if no route matched
app.use(errorHandler); // unified error format

app.listen(PORT, () => {
  console.log(`[Express] Server running on http://localhost:${PORT}`); // startup message
  console.log(`[Safety-Net] ${getSafetyNetRuleTags().length} critical rules loaded`); // rule count
});

export default app;
