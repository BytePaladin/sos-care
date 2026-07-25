/**
 * triageEngine.js
 * --------------------------------------------------------------------------
 * Hybrid Severity Decision (Proposal Figure 2)
 *
 *   final = RED  , যদি safety-net keyword hit করে
 *   final = ML label , অন্য সব ক্ষেত্রে
 *
 * অর্থাৎ ML ভুল করলেও স্পষ্ট বিপজ্জনক message কখনো নিচে নামবে না.
 * --------------------------------------------------------------------------
 */

import { classifyMessage } from './mlClient.js'; // Flask ML service client
import { runSafetyNet } from './safetyNet.js'; // deterministic keyword layer
import { SEVERITY } from '../utils/severity.js'; // severity constant

/**
 * একটি message এর জন্য সম্পূর্ণ triage সিদ্ধান্ত তৈরি করে.
 * @param {string} text — রোগীর message
 * @returns {Promise<object>} — audit-সহ পূর্ণ ফলাফল
 */
export const evaluateMessage = async (text) => {
  const cleanText = String(text || '').trim(); // input safe করে নেওয়া

  // দুইটি path সমান্তরালে চলে (Figure 2-এর মতো) — তাই Promise.all
  const [mlResult, safetyResult] = await Promise.all([
    classifyMessage(cleanText), // path 1: ML classifier
    Promise.resolve(runSafetyNet(cleanText)), // path 2: rule engine (sync, তবু একসাথে রাখা)
  ]);

  // override rule: keyword hit করলে RED, নাহলে ML যা বলেছে তাই
  const finalLabel = safetyResult.triggered ? SEVERITY.RED : mlResult.label;

  return {
    mlLabel: mlResult.label, // model কী বলেছিল (audit-এর জন্য সংরক্ষিত)
    confidence: mlResult.confidence, // model কতটা নিশ্চিত ছিল
    modelSource: mlResult.source, // ml-service নাকি fallback-heuristic
    ruleOverride: safetyResult.triggered, // safety-net চালু হয়েছিল কিনা
    matchedKeywords: safetyResult.matchedKeywords, // কোন কোন rule hit করেছে
    finalLabel, // queue-তে যেটি ব্যবহার হবে
  };
};

// রোগীকে দেখানো bot reply — label ও override অনুযায়ী বার্তা তৈরি হয়
export const buildPatientReply = (finalLabel, ruleOverride) => {
  // RED — জরুরি বার্তা, safety-net চালু হলে আলাদা করে জানানো হয়
  if (finalLabel === SEVERITY.RED) {
    return ruleOverride
      ? '🚨 URGENT: Your message contains a critical warning sign. Your case has been escalated to the top of the medical staff queue. If this is an emergency, please go to the nearest Emergency Room now or call +880 1700-000000.'
      : '🚨 URGENT: Your symptoms have been marked as high priority. A member of the medical team will be alerted. If your condition worsens, please go to the Emergency Room immediately.';
  }

  // YELLOW — পর্যালোচনার জন্য সারিতে রাখা হচ্ছে
  if (finalLabel === SEVERITY.YELLOW) {
    return '⚠️ NEEDS REVIEW: Your symptoms have been logged for practitioner review. If anything gets worse before we reach you, please call our help desk at +880 1800-000000.';
  }

  // GREEN — রুটিন বার্তা
  return '✅ ROUTINE: Your message has been logged. The care team will respond in the normal cycle. For appointments or general queries, call +880 1900-000000.';
};

/**
 * PatientTriage document-এ সংরক্ষণের জন্য aiAnalysis অংশ তৈরি করে.
 * @param {string} text — রোগীর message
 * @param {object} decision — evaluateMessage() এর ফল
 */
export const buildAiAnalysis = (text, decision) => ({
  symptomSummary: `Screened via chat: "${String(text).trim().slice(0, 120)}"`, // সংক্ষিপ্ত সারাংশ
  symptomTags: decision.matchedKeywords, // safety-net এ যেসব tag ধরা পড়েছে
  confidenceScore: Number(decision.confidence?.toFixed?.(2) ?? decision.confidence ?? 0), // 2 দশমিক
  riskFactors: decision.ruleOverride ? ['Safety-net keyword override'] : [], // override হলে উল্লেখ
});
