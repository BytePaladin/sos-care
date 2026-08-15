/**
 * triageEngine.js
 * --------------------------------------------------------------------------
 * Hybrid Severity Decision (Proposal Figure 2)
 *
 *   final = RED  , if safety-net keyword hits
 *   final = ML label , in all other cases
 *
 * That is, even if the ML model fails, explicitly dangerous messages will
 * never be downgraded.
 *
 * ⚠ This function must stay deterministic. The same message must always
 * produce the same decision. A random or time-dependent classification here
 * silently disables the safety net for every patient, because the keyword
 * layer is bypassed along with everything else — and it also makes the stored
 * audit trail untrue, since ruleOverride and matchedKeywords would no longer
 * describe what actually happened.
 *
 * `npm run selftest` asserts this: it classifies the same message repeatedly
 * and fails if the answers differ.
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

  // Both paths run together, mirroring the parallel design in Figure 2
  const [mlResult, safetyResult] = await Promise.all([
    classifyMessage(cleanText), // path 1: ML classifier (or its fallback)
    Promise.resolve(runSafetyNet(cleanText)), // path 2: deterministic rule engine
  ]);

  // The override rule: a critical keyword forces RED regardless of the model
  const finalLabel = safetyResult.triggered ? SEVERITY.RED : mlResult.label;

  return {
    mlLabel: mlResult.label, // what the classifier said, kept for audit
    confidence: mlResult.confidence, // how sure the classifier was
    modelSource: mlResult.source, // ml-service or fallback-heuristic
    topFeatures: mlResult.topFeatures || [], // which words drove the model's choice
    ruleOverride: safetyResult.triggered, // did the safety net fire
    matchedKeywords: safetyResult.matchedKeywords, // which rules matched
    finalLabel, // the label the queue is ordered by
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
  // The terms that drove the classifier towards this tier. Stored so a clinician
  // can see *why* a case was ranked where it was, rather than being asked to
  // trust an unexplained label — and so the reasoning is preserved in the audit
  // trail even after the model is retrained.
  modelEvidence: (decision.topFeatures || []).map((f) => ({
    term: f.term,
    weight: Number(Number(f.weight).toFixed(3)),
  })),
});
