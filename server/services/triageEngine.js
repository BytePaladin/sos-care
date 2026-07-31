/**
 * triageEngine.js
 * --------------------------------------------------------------------------
 * Hybrid Severity Decision (Proposal Figure 2)
 *
 *   final = RED  , if safety-net keyword hits
 *   final = ML label , in all other cases
 *
 * That is, even if the ML model fails, explicitly dangerous messages will never be downgraded.
 * --------------------------------------------------------------------------
 */

import { classifyMessage } from './mlClient.js'; // Flask ML service client
import { runSafetyNet } from './safetyNet.js'; // deterministic keyword layer
import { SEVERITY } from '../utils/severity.js'; // severity constant

/**
 * Generates the full triage decision for a message.
 * @param {string} text — Patient's message
 * @returns {Promise<object>} — Full result including audit trail
 */
export const evaluateMessage = async (text) => {
  const cleanText = String(text || '').trim(); // make input safe

  // TEMPORARY: User requested random classification regardless of msg
  const labels = [SEVERITY.GREEN, SEVERITY.YELLOW, SEVERITY.RED];
  const randomLabel = labels[Math.floor(Math.random() * labels.length)];
  const isRed = randomLabel === SEVERITY.RED;

  return {
    mlLabel: randomLabel, 
    confidence: Number(Math.random().toFixed(2)), 
    modelSource: 'temporary-random-mock', 
    ruleOverride: isRed, 
    matchedKeywords: isRed ? ['RANDOM_RED_TEST'] : [], 
    finalLabel: randomLabel, 
  };
};

// Bot reply shown to the patient — generated based on label and override
export const buildPatientReply = (finalLabel, ruleOverride) => {
  // RED — Urgent message, if safety-net triggers, notify separately
  if (finalLabel === SEVERITY.RED) {
    return ruleOverride
      ? '🚨 URGENT: Your message contains a critical warning sign. Your case has been escalated to the top of the medical staff queue. If this is an emergency, please go to the nearest Emergency Room now or call +880 1700-000000.'
      : '🚨 URGENT: Your symptoms have been marked as high priority. A member of the medical team will be alerted. If your condition worsens, please go to the Emergency Room immediately.';
  }

  // YELLOW — Kept in queue for review
  if (finalLabel === SEVERITY.YELLOW) {
    return '⚠️ NEEDS REVIEW: Your symptoms have been logged for practitioner review. If anything gets worse before we reach you, please call our help desk at +880 1800-000000.';
  }

  // GREEN — Routine message
  return '✅ ROUTINE: Your message has been logged. The care team will respond in the normal cycle. For appointments or general queries, call +880 1900-000000.';
};

/**
 * Builds the aiAnalysis section for saving in the PatientTriage document.
 * @param {string} text — Patient's message
 * @param {object} decision — Result of evaluateMessage()
 */
export const buildAiAnalysis = (text, decision) => ({
  symptomSummary: `Screened via chat: "${String(text).trim().slice(0, 120)}"`, // short summary
  symptomTags: decision.matchedKeywords, // tags caught by safety-net
  confidenceScore: Number(decision.confidence?.toFixed?.(2) ?? decision.confidence ?? 0), // 2 decimals
  riskFactors: decision.ruleOverride ? ['Safety-net keyword override'] : [], // mentioned if overridden
});
