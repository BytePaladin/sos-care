/**
 * mlClient.js
 * --------------------------------------------------------------------------
 * Flask ML Microservice Client (Proposal Section 7 & Figure 1)
 *
 * The backend's responsibility is to send the message to the Flask service to fetch the severity label.
 * If the ML service is not yet built or is down, the entire system shouldn't stop,
 * so a deterministic fallback heuristic is implemented.
 * (The previous Math.random() based placeholder has been completely removed.)
 * --------------------------------------------------------------------------
 */

import { SEVERITY, normalizeSeverity } from '../utils/severity.js'; // severity constant and normalizer

// Where the Flask service is running — comes from .env, fallback to localhost:5001
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:5001';

// How many ms to wait for the ML service — if it takes too long, we go to fallback
const ML_TIMEOUT_MS = Number(process.env.ML_TIMEOUT_MS || 4000);

/**
 * Fallback heuristic — used when the ML service is not available.
 * This is not ML, just weighted keyword scoring; but deterministic (not random).
 */
const fallbackHeuristic = (text) => {
  // Matching substring might match "fee" inside "I feel" — hence using word-boundary regex
  const countHits = (terms) =>
    terms.filter((term) => new RegExp(`\\b${term}\\b`, 'i').test(text)).length; // How many terms matched

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

  const yellowScore = countHits(yellowHints); // how many symptom hints matched
  const greenScore = countHits(greenHints); // how many routine hints matched

  // Yellow if symptom hints are at least equal — err on the side of safety
  const label = yellowScore > 0 && yellowScore >= greenScore ? SEVERITY.YELLOW : SEVERITY.GREEN;

  return {
    label, // estimated severity
    confidence: 0.35, // low confidence — this is not the real ML model
    source: 'fallback-heuristic', // source can be tracked in audit
  };
};

/**
 * Calls POST /predict on Flask ML microservice to get severity.
 * @param {string} text — Patient's message
 * @returns {Promise<{label:string, confidence:number, source:string}>}
 */
export const classifyMessage = async (text) => {
  // If empty message, directly Green — no need to call the service
  if (typeof text !== 'string' || !text.trim()) {
    return { label: SEVERITY.GREEN, confidence: 0, source: 'empty-input' };
  }

  try {
    // Using Node 18+ built-in fetch — no extra package needed
    const response = await fetch(`${ML_SERVICE_URL}/predict`, {
      method: 'POST', // Flask service accepts POST
      headers: { 'Content-Type': 'application/json' }, // Sending JSON body
      body: JSON.stringify({ text: text.trim() }), // Sending only the message text
      signal: AbortSignal.timeout(ML_TIMEOUT_MS), // Cancel request after specified time
    });

    // If HTTP status is not ok, go to fallback
    if (!response.ok) {
      console.warn(`[ML] Service responded ${response.status} — using fallback`);
      return fallbackHeuristic(text); // heuristic if service fails
    }

    const data = await response.json(); // parse JSON coming from Flask

    return {
      label: normalizeSeverity(data.label ?? data.severity), // safely normalize label
      confidence: Number(data.confidence ?? 0), // 0 if no confidence
      source: 'ml-service', // came from the actual model
    };
  } catch (error) {
    // timeout / connection refused / JSON parse — system will stay running in all cases
    console.warn(`[ML] Unreachable (${error.name}) — using fallback heuristic`);
    return fallbackHeuristic(text); // graceful degradation
  }
};

/**
 * Helper to check if ML service is alive — used in /api/health.
 */
export const pingMlService = async () => {
  try {
    const response = await fetch(`${ML_SERVICE_URL}/health`, {
      signal: AbortSignal.timeout(1500), // health check should be fast
    });
    return response.ok; // return true if 200
  } catch {
    return false; // return false if caught
  }
};
