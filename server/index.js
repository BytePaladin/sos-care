/**
 * index.js — S.O.S. Care API server entry point
 * Week 3 update: request logger, 404 handler, centralised error handler,
 * সমৃদ্ধ health check এবং শুরুতেই environment যাচাই যোগ করা হয়েছে.
 */

import express from 'express'; // web framework
import cors from 'cors'; // frontend থেকে call করার অনুমতি
import dotenv from 'dotenv'; // .env পড়ার জন্য
import path from 'path'; // path তৈরি করতে
import { fileURLToPath } from 'url'; // ESM-এ __dirname বের করতে
import { connectDB } from './config/db.js'; // MongoDB সংযোগ

import authRoutes from './routes/authRoutes.js'; // /api/auth
import triageRoutes from './routes/triageRoutes.js'; // /api/triage
import chatRoutes from './routes/chatRoutes.js'; // /api/chats
import { notFound, errorHandler } from './middleware/errorHandler.js'; // error middleware
import { pingMlService } from './services/mlClient.js'; // ML service জীবিত কিনা
import { getSafetyNetRuleTags } from './services/safetyNet.js'; // কতগুলো rule আছে

const __filename = fileURLToPath(import.meta.url); // বর্তমান ফাইলের path
const __dirname = path.dirname(__filename); // বর্তমান ফোল্ডার

// পরিবেশ ভেরিয়েবল লোড — আগে root-এর .env.local, তারপর server-এর .env
dotenv.config({ path: path.join(__dirname, '../.env.local') }); // root override file
dotenv.config(); // server/.env

const app = express(); // express app
const PORT = process.env.PORT || 5000; // কোন port-এ চলবে

// ── শুরুতেই জরুরি env variable যাচাই — ভুল থাকলে এখনই সতর্ক করা ভালো ──
if (!process.env.JWT_SECRET) {
  console.warn('[Warn] JWT_SECRET is not set — falling back to the default dev secret.'); // production-এ অবশ্যই সেট করতে হবে
}
if (!process.env.MONGODB_URI) {
  console.warn('[Warn] MONGODB_URI is not set — falling back to local mongodb://127.0.0.1:27017/sos-care');
}

connectDB(); // MongoDB সংযোগ শুরু

// ── Middleware ──
app.use(cors()); // সব origin-কে অনুমতি (demo-এর জন্য যথেষ্ট)
app.use(express.json({ limit: '1mb' })); // JSON body parse, বড় payload আটকানো

// প্রতিটি request কত সময় নিল তা log করা — debugging-এ খুব কাজে দেয়
app.use((req, res, next) => {
  const startedAt = Date.now(); // শুরুর সময়
  res.on('finish', () => {
    const ms = Date.now() - startedAt; // মোট সময়
    console.log(`[API] ${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)`); // log line
  });
  next(); // পরবর্তী middleware
});

// ── API Routes ──
app.use('/api/auth', authRoutes); // authentication
app.use('/api/triage', triageRoutes); // staff dashboard
app.use('/api/chats', chatRoutes); // patient screening

// ── Health check (ML service ও safety-net status সহ) ──
app.get('/api/health', async (req, res) => {
  const mlAlive = await pingMlService(); // Flask service সাড়া দিচ্ছে কিনা

  res.json({
    status: 'OK', // server চালু
    message: 'S.O.S. Care API Server running', // পুরনো frontend এই key দেখে
    mlService: mlAlive ? 'online' : 'offline (fallback heuristic active)', // ML অবস্থা
    safetyNetRules: getSafetyNetRuleTags().length, // কতগুলো critical rule সক্রিয়
    timestamp: new Date().toISOString(), // সময়
  });
});

// ── Error handling (সব route-এর পরে বসাতে হয়) ──
app.use(notFound); // কোনো route না মিললে 404
app.use(errorHandler); // সব error এক format-এ

app.listen(PORT, () => {
  console.log(`[Express] Server running on http://localhost:${PORT}`); // startup বার্তা
  console.log(`[Safety-Net] ${getSafetyNetRuleTags().length} critical rules loaded`); // rule সংখ্যা
});
