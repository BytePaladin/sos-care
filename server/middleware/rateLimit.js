/**
 * rateLimit.js
 * --------------------------------------------------------------------------
 * Week 5: brute-force protection for the authentication endpoints.
 *
 * Without this, `POST /api/auth/login` accepts unlimited attempts, so a
 * script could work through a password list against a known phone number at
 * whatever speed the network allows. For a system holding patient symptom
 * histories that is not an acceptable default.
 *
 * Implemented as a sliding window held in memory. No package was installed
 * (express-rate-limit would have been the obvious choice) because the project
 * commits to zero added dependencies, and the algorithm is short enough to
 * write and reason about directly.
 *
 * KNOWN LIMITATION — stated plainly rather than discovered later:
 * the counter lives in this process's memory. It resets when the server
 * restarts, and if the API is ever run as more than one instance each
 * instance keeps its own count. That is acceptable for a single-instance
 * deployment; a shared store (Redis, or a MongoDB TTL collection) would be
 * required before running multiple instances.
 * --------------------------------------------------------------------------
 */

// key → { count, windowStart }
const buckets = new Map();

// Old entries are swept periodically so the Map cannot grow without bound
// on a long-running server. unref() keeps this timer from holding the
// process open — otherwise `npm run seed` and the test scripts would hang.
const SWEEP_INTERVAL_MS = 10 * 60 * 1000; // every 10 minutes
const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (now - entry.windowStart > entry.windowMs) buckets.delete(key);
  }
}, SWEEP_INTERVAL_MS);
if (typeof sweeper.unref === 'function') sweeper.unref();

/**
 * Identifies the caller. Behind a proxy (Vercel, Render) the real client
 * address arrives in x-forwarded-for, so that is preferred when present.
 */
const getClientKey = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? String(forwarded).split(',')[0].trim() : req.ip || req.socket?.remoteAddress || 'unknown';
  return ip;
};

/**
 * Builds a rate-limiting middleware.
 *
 * @param {object} opts
 * @param {number} opts.windowMs — length of the window in milliseconds
 * @param {number} opts.max — how many requests are allowed in that window
 * @param {string} opts.name — namespace, so login and register count separately
 * @param {string} [opts.message] — what the caller is told when blocked
 */
export const rateLimit = ({ windowMs, max, name, message }) => (req, res, next) => {
  // Escape hatch for local development and for the demo — if the limiter
  // ever gets in the way during a live presentation it can be turned off
  // with one environment variable rather than a code change.
  if (process.env.RATE_LIMIT_DISABLED === 'true') return next();

  const key = `${name}:${getClientKey(req)}`;
  const now = Date.now();
  const entry = buckets.get(key);

  // First request, or the previous window has fully elapsed → start fresh
  if (!entry || now - entry.windowStart > windowMs) {
    buckets.set(key, { count: 1, windowStart: now, windowMs });
    res.set('X-RateLimit-Limit', String(max));
    res.set('X-RateLimit-Remaining', String(max - 1));
    return next();
  }

  entry.count += 1;

  if (entry.count > max) {
    const retryAfterSec = Math.ceil((entry.windowStart + windowMs - now) / 1000);
    res.set('Retry-After', String(retryAfterSec));
    res.set('X-RateLimit-Limit', String(max));
    res.set('X-RateLimit-Remaining', '0');

    console.warn(`[RateLimit] ${name} blocked ${getClientKey(req)} (${entry.count} attempts)`);

    return res.status(429).json({
      message: message || `Too many requests. Please try again in ${retryAfterSec} seconds.`,
    });
  }

  res.set('X-RateLimit-Limit', String(max));
  res.set('X-RateLimit-Remaining', String(Math.max(0, max - entry.count)));
  return next();
};

// ── Preset limiters used by the auth routes ──────────────────────────────

// Login: deliberately generous. The goal is to stop an automated password
// list, not to lock out a nurse who mistypes twice on a night shift.
export const loginLimiter = rateLimit({
  name: 'login',
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: 'Too many login attempts from this address. Please wait a few minutes and try again.',
});

// Registration is tighter — a legitimate user registers once.
export const registerLimiter = rateLimit({
  name: 'register',
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: 'Too many accounts created from this address. Please try again later.',
});

// Exported for the self-test, which needs a clean slate between runs.
export const _resetRateLimitState = () => buckets.clear();
