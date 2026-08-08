/**
 * mlClient.js
 * --------------------------------------------------------------------------
 * Flask ML Microservice Client (Proposal Section 7 & Figure 1)
 *
 * The backend's responsibility is to send the message to the Flask service to
 * fetch the severity label. If the ML service is not yet built or is down, the
 * entire system shouldn't stop, so a deterministic fallback heuristic is used.
 * (The original Math.random() placeholder was removed in Week 3.)
 *
 * Week 6 additions, ahead of integrating the real model:
 *   1. Response validation — a 200 with a nonsense body is now treated as a
 *      failure rather than trusted. Previously any JSON that came back was
 *      normalised and stored, so a service returning {"error": "..."} with a
 *      200 status would have produced a silent "yellow" attributed to the model.
 *   2. One retry on transient failure — a connection refused during a Flask
 *      reload should not cost a patient their classification.
 *   3. A circuit breaker — when the service is genuinely down, stop paying the
 *      timeout on every single message and go straight to the fallback.
 *
 * The contract this file implements is written down in docs/ML_SERVICE_CONTRACT.md.
 * --------------------------------------------------------------------------
 */

import { SEVERITY, normalizeSeverity, isValidSeverity } from '../utils/severity.js';

// Where the Flask service is running — comes from .env, fallback to localhost:5001
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:5001';

// How many ms to wait for the ML service — if it takes too long, we go to fallback
const ML_TIMEOUT_MS = Number(process.env.ML_TIMEOUT_MS || 4000);

// One retry by default: enough to survive a service reload, not enough to
// multiply the patient's wait if the service is truly gone
const ML_RETRY_ATTEMPTS = Number(process.env.ML_RETRY_ATTEMPTS || 1);

// Circuit breaker — after this many consecutive failures, stop trying
const BREAKER_THRESHOLD = Number(process.env.ML_BREAKER_THRESHOLD || 5);
const BREAKER_COOLDOWN_MS = Number(process.env.ML_BREAKER_COOLDOWN_MS || 30000);

// Breaker state. Deliberately module-level and in-process: it is a latency
// optimisation, not a correctness mechanism, so it does not need to be shared
// between instances. The worst case if it is wrong is one extra timeout.
const breaker = {
  consecutiveFailures: 0,
  openedAt: null, // when the breaker tripped; null while closed
};

/** True while the breaker is open and still inside its cooldown. */
const isBreakerOpen = () => {
  if (breaker.openedAt === null) return false;
  if (Date.now() - breaker.openedAt >= BREAKER_COOLDOWN_MS) {
    // Cooldown elapsed — half-open: allow the next call through to test the service
    breaker.openedAt = null;
    breaker.consecutiveFailures = 0;
    console.log('[ML] Circuit breaker cooldown elapsed — retrying service');
    return false;
  }
  return true;
};

const recordSuccess = () => {
  if (breaker.consecutiveFailures > 0) {
    console.log('[ML] Service recovered');
  }
  breaker.consecutiveFailures = 0;
  breaker.openedAt = null;
};

const recordFailure = () => {
  breaker.consecutiveFailures += 1;
  if (breaker.consecutiveFailures >= BREAKER_THRESHOLD && breaker.openedAt === null) {
    breaker.openedAt = Date.now();
    console.warn(
      `[ML] Circuit breaker OPEN after ${breaker.consecutiveFailures} failures — ` +
        `using fallback for the next ${BREAKER_COOLDOWN_MS / 1000}s`
    );
  }
};

/**
 * Validates the body returned by the ML service against the v1 contract.
 * Returning 200 is not by itself evidence that a prediction was produced.
 *
 * @returns {{ok: true, label: string, confidence: number} | {ok: false, reason: string}}
 */
export const validateMlResponse = (data) => {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, reason: 'body is not a JSON object' };
  }

  // The contract allows either key; anything else means the service did not
  // send a prediction, whatever status code it used
  const raw = data.label ?? data.severity;
  if (raw === undefined || raw === null) {
    return { ok: false, reason: 'no label or severity field' };
  }

  if (typeof raw !== 'string') {
    return { ok: false, reason: `label is ${typeof raw}, expected string` };
  }

  const label = normalizeSeverity(raw);

  // normalizeSeverity never throws — an unknown string becomes 'yellow'. That
  // fail-safe is correct for a genuine prediction the backend cannot parse,
  // but a label the service never intended to send should be reported as a
  // failure so it shows up as fallback-heuristic rather than as model output.
  // Note: isValidSeverity does not trim, so the value is cleaned first —
  // a service that sends "  RED " is sending a perfectly intentional label.
  const cleaned = raw.trim().toLowerCase();
  const looksIntentional =
    isValidSeverity(cleaned) ||
    ['urgent', 'critical', 'routine', 'low', 'moderate', 'needs_review', 'review'].includes(cleaned);

  if (!looksIntentional) {
    return { ok: false, reason: `unrecognised label "${String(raw).slice(0, 30)}"` };
  }

  // Confidence is optional; a non-numeric value is treated as absent
  const rawConfidence = Number(data.confidence);
  const confidence = Number.isFinite(rawConfidence) ? Math.min(Math.max(rawConfidence, 0), 1) : 0;

  // Optional explanation: the terms that pushed the message towards this tier.
  // Purely additive — the contract does not require it, and a service that
  // omits it behaves exactly as before.
  const topFeatures = Array.isArray(data.topFeatures)
    ? data.topFeatures
        .filter((f) => f && typeof f.term === 'string' && Number.isFinite(Number(f.weight)))
        .slice(0, 8)
        .map((f) => ({ term: f.term, weight: Number(f.weight) }))
    : [];

  return { ok: true, label, confidence, topFeatures };
};

/**
 * Fallback heuristic — used when the ML service is not available.
 * This is not ML, just weighted keyword scoring; but deterministic (not random).
 */
const fallbackHeuristic = (text) => {
  // Matching substring would match "fee" inside "I feel" — hence word-boundary regex
  const countHits = (terms) =>
    terms.filter((term) => new RegExp(`\\b${term}\\b`, 'i').test(text)).length;

  // Kidney symptoms indicating Yellow-level (with stems, e.g., swell → swelling)
  const yellowHints = [
    'swell\\w*', 'edema', 'oedema', 'puffy', 'puffiness', // fluid retention
    'tired', 'fatigue', 'weak\\w*', 'dizzy', 'dizziness', // weakness
    'nausea', 'nauseous', 'vomit\\w*', 'cramp\\w*', // nausea and cramps
    'foamy', 'burning', 'itch\\w*', 'less urine', 'dark urine', // urine changes
    'fever', 'back pain', 'flank pain', 'headache', // other symptoms
    'blood pressure', 'creatinine', 'dialysis', 'medication', 'medicine', // risky contexts
  ];

  // Green-level hints — routine or administrative queries
  const greenHints = [
    'appointment', 'reschedule', 'schedule', 'booking', // scheduling
    'diet', 'eat\\w*', 'food', 'banana\\w*', 'water', 'drink\\w*', // dietary queries
    'report', 'receipt', 'payment', 'cost', 'charge', // administrative
    'thank\\w*', 'hello', 'timing', 'address', 'contact', // courtesy and info
  ];

  const yellowScore = countHits(yellowHints);
  const greenScore = countHits(greenHints);

  // Yellow if symptom hints are at least equal — err on the side of safety
  const label = yellowScore > 0 && yellowScore >= greenScore ? SEVERITY.YELLOW : SEVERITY.GREEN;

  return {
    label,
    confidence: 0.35, // low confidence — this is not the real ML model
    topFeatures: [], // the heuristic has no model weights to explain
    source: 'fallback-heuristic',
  };
};

/**
 * A single attempt against the ML service. Throws on any failure so the
 * retry loop in classifyMessage can decide whether to try again.
 */
const attemptPredict = async (text) => {
  const response = await fetch(`${ML_SERVICE_URL}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(ML_TIMEOUT_MS),
  });

  if (!response.ok) {
    const err = new Error(`ML service responded ${response.status}`);
    // 5xx and 429 are worth retrying; a 4xx means the request itself is wrong
    err.retryable = response.status >= 500 || response.status === 429;
    throw err;
  }

  let data;
  try {
    data = await response.json();
  } catch {
    const err = new Error('ML service returned a non-JSON body');
    err.retryable = false; // retrying will not make it parse
    throw err;
  }

  const validated = validateMlResponse(data);
  if (!validated.ok) {
    const err = new Error(`ML service returned an invalid prediction: ${validated.reason}`);
    err.retryable = false; // a malformed contract is not a transient fault
    throw err;
  }

  return {
    label: validated.label,
    confidence: validated.confidence,
    topFeatures: validated.topFeatures,
    source: 'ml-service',
  };
};

/**
 * Calls the ML microservice to classify a message, with retry, circuit
 * breaking and graceful fallback.
 *
 * @param {string} text — Patient's message
 * @returns {Promise<{label:string, confidence:number, source:string}>}
 */
export const classifyMessage = async (text) => {
  // If empty message, directly Green — no need to call the service
  if (typeof text !== 'string' || !text.trim()) {
    return { label: SEVERITY.GREEN, confidence: 0, source: 'empty-input' };
  }

  const clean = text.trim();

  // Breaker open: skip the network call entirely rather than pay the timeout
  // on every message while the service is known to be down
  if (isBreakerOpen()) {
    return fallbackHeuristic(clean);
  }

  let lastError = null;

  // One initial attempt plus ML_RETRY_ATTEMPTS retries
  for (let attempt = 0; attempt <= ML_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const result = await attemptPredict(clean);
      recordSuccess();
      return result;
    } catch (error) {
      lastError = error;

      // A timeout or connection error has no .retryable flag set, and both are
      // exactly the transient conditions worth one more attempt
      const retryable = error.retryable !== false;
      if (!retryable || attempt === ML_RETRY_ATTEMPTS) break;

      console.warn(`[ML] Attempt ${attempt + 1} failed (${error.message}) — retrying once`);
    }
  }

  recordFailure();
  console.warn(`[ML] Unavailable (${lastError?.message || 'unknown'}) — using fallback heuristic`);
  return fallbackHeuristic(clean);
};

/**
 * Helper to check if ML service is alive — used in /api/health.
 */
export const pingMlService = async () => {
  try {
    const response = await fetch(`${ML_SERVICE_URL}/health`, {
      signal: AbortSignal.timeout(1500), // health check should be fast
    });
    return response.ok;
  } catch {
    return false;
  }
};

/** Current breaker state — surfaced in /api/health for visibility. */
export const getMlBreakerState = () => ({
  open: breaker.openedAt !== null,
  consecutiveFailures: breaker.consecutiveFailures,
});

/** Resets breaker state. Used by the contract-check script between probes. */
export const _resetMlBreaker = () => {
  breaker.consecutiveFailures = 0;
  breaker.openedAt = null;
};
