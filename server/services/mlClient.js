/**
 * mlClient.js
 * --------------------------------------------------------------------------
 * Flask ML Microservice Client (Proposal Section 7 & Figure 1)
 *
 * Backend-এর দায়িত্ব হলো message টি Flask service-এ পাঠিয়ে severity label আনা.
 * ML service এখনো তৈরি না হলে বা down থাকলে পুরো system যেন বন্ধ না হয়,
 * সেজন্য একটি deterministic fallback heuristic রাখা হয়েছে.
 * (আগের Math.random() ভিত্তিক placeholder সম্পূর্ণ বাদ দেওয়া হয়েছে.)
 * --------------------------------------------------------------------------
 */

import { SEVERITY, normalizeSeverity } from '../utils/severity.js'; // severity constant ও normalizer

// Flask service কোথায় চলছে — .env থেকে আসবে, না থাকলে localhost:5001
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:5001';

// ML service কত ms পর্যন্ত অপেক্ষা করব — বেশি দেরি হলে fallback-এ যাব
const ML_TIMEOUT_MS = Number(process.env.ML_TIMEOUT_MS || 4000);

/**
 * Fallback heuristic — ML service না থাকলে ব্যবহার হয়.
 * এটি ML নয়, শুধু weighted keyword scoring; কিন্তু deterministic (random নয়).
 */
const fallbackHeuristic = (text) => {
  // substring মিলালে "I feel" এর ভেতরে "fee" ধরা পড়ে যায় — তাই word-boundary regex ব্যবহার
  const countHits = (terms) =>
    terms.filter((term) => new RegExp(`\\b${term}\\b`, 'i').test(text)).length; // কতগুলো term মিলল

  // Yellow-স্তরের ইঙ্গিত দেয় এমন kidney উপসর্গ (stem সহ, যেমন swell → swelling)
  const yellowHints = [
    'swell\\w*', 'edema', 'oedema', 'puffy', 'puffiness', // পানি জমা
    'tired', 'fatigue', 'weak\\w*', 'dizzy', 'dizziness', // দুর্বলতা
    'nausea', 'nauseous', 'vomit\\w*', 'cramp\\w*', // বমিভাব ও খিঁচ
    'foamy', 'burning', 'itch\\w*', 'less urine', 'dark urine', // প্রস্রাবের পরিবর্তন
    'fever', 'back pain', 'flank pain', 'headache', // অন্যান্য উপসর্গ
    'blood pressure', 'creatinine', 'dialysis', 'medication', 'medicine', // ঝুঁকিপূর্ণ প্রসঙ্গ
  ];

  // Green-স্তরের ইঙ্গিত — রুটিন বা প্রশাসনিক প্রশ্ন
  const greenHints = [
    'appointment', 'reschedule', 'schedule', 'booking', // সময়সূচি
    'diet', 'eat\\w*', 'food', 'banana\\w*', 'water', 'drink\\w*', // খাদ্য প্রশ্ন
    'report', 'receipt', 'payment', 'cost', 'charge', // প্রশাসনিক
    'thank\\w*', 'hello', 'timing', 'address', 'contact', // সৌজন্য ও তথ্য
  ];

  const yellowScore = countHits(yellowHints); // কতগুলো উপসর্গ-ইঙ্গিত মিলল
  const greenScore = countHits(greenHints); // কতগুলো রুটিন-ইঙ্গিত মিলল

  // উপসর্গের ইঙ্গিত অন্তত সমান হলেও Yellow — কারণ ভুলটা নিরাপদ দিকে হওয়া উচিত
  const label = yellowScore > 0 && yellowScore >= greenScore ? SEVERITY.YELLOW : SEVERITY.GREEN;

  return {
    label, // অনুমিত severity
    confidence: 0.35, // কম confidence — এটি আসল ML model নয়
    source: 'fallback-heuristic', // audit-এ উৎস বোঝা যাবে
  };
};

/**
 * Flask ML microservice-এ POST /predict কল করে severity আনে.
 * @param {string} text — রোগীর message
 * @returns {Promise<{label:string, confidence:number, source:string}>}
 */
export const classifyMessage = async (text) => {
  // খালি message হলে সরাসরি Green — service কল করার দরকার নেই
  if (typeof text !== 'string' || !text.trim()) {
    return { label: SEVERITY.GREEN, confidence: 0, source: 'empty-input' };
  }

  try {
    // Node 18+ এর built-in fetch ব্যবহার — বাড়তি কোনো package লাগছে না
    const response = await fetch(`${ML_SERVICE_URL}/predict`, {
      method: 'POST', // Flask service POST গ্রহণ করে
      headers: { 'Content-Type': 'application/json' }, // JSON body পাঠাচ্ছি
      body: JSON.stringify({ text: text.trim() }), // শুধু message text পাঠানো হচ্ছে
      signal: AbortSignal.timeout(ML_TIMEOUT_MS), // নির্দিষ্ট সময়ের পর request বাতিল
    });

    // HTTP status ঠিক না থাকলে fallback-এ চলে যাব
    if (!response.ok) {
      console.warn(`[ML] Service responded ${response.status} — using fallback`);
      return fallbackHeuristic(text); // service সমস্যা করলে heuristic
    }

    const data = await response.json(); // Flask থেকে আসা JSON parse

    // Flask predict.py আসল classifier label পাঠায় mlLabel key-এ (finalLabel নয়) —
    // safety-net override এখানে Node-এর নিজের runSafetyNet() করবে, তাই raw model
    // label-টাই এখানে দরকার, নাহলে দুইটা safety-net স্তর একে অপরের audit ঢেকে ফেলবে।
    return {
      label: normalizeSeverity(data.mlLabel), // label normalize করে নিরাপদ করা
      confidence: Number(data.confidence ?? 0), // confidence না থাকলে 0
      source: 'ml-service', // আসল model থেকে এসেছে
    };
  } catch (error) {
    // timeout / connection refused / JSON parse — সব ক্ষেত্রেই system চালু থাকবে
    console.warn(`[ML] Unreachable (${error.name}) — using fallback heuristic`);
    return fallbackHeuristic(text); // graceful degradation
  }
};

/**
 * ML service জীবিত আছে কিনা তা দেখার helper — /api/health এ ব্যবহার হচ্ছে.
 */
export const pingMlService = async () => {
  try {
    const response = await fetch(`${ML_SERVICE_URL}/health`, {
      signal: AbortSignal.timeout(1500), // health check দ্রুত হওয়া উচিত
    });
    return response.ok; // 200 হলে true
  } catch {
    return false; // ধরা না গেলে false
  }
};
