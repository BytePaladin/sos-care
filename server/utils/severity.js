/**
 * severity.js
 * Green / Yellow / Red — এই তিনটি tier প্রজেক্টের সব জায়গায় একই রকম রাখার জন্য
 * এক জায়গায় constant + helper রাখা হয়েছে (proposal Section 5 অনুযায়ী).
 */

// তিনটি severity label-এর canonical (আসল) নাম — DB-তে সব সময় lowercase রাখা হবে
export const SEVERITY = {
  GREEN: 'green', // routine — সাধারণ প্রশ্ন
  YELLOW: 'yellow', // needs review — পর্যবেক্ষণ দরকার
  RED: 'red', // urgent — জরুরি
};

// queue sorting-এর জন্য সংখ্যাগত priority (বেশি সংখ্যা = আগে দেখাবে)
export const SEVERITY_PRIORITY = {
  red: 3, // Red সবার আগে
  yellow: 2, // তারপর Yellow
  green: 1, // সবশেষে Green
};

// dashboard-এ staff যেসব review status ব্যবহার করে (ER diagram অনুযায়ী)
export const REVIEW_STATUSES = ['pending', 'contacted', 'false_positive', 'needs_review'];

/**
 * বাইরে থেকে আসা যেকোনো label ("RED", "Red ", "urgent") কে
 * নিরাপদভাবে canonical lowercase label-এ রূপান্তর করে.
 * অচেনা কিছু পেলে fail-safe হিসেবে 'yellow' দেয় (green নয়) —
 * কারণ অজানা জিনিস routine ধরে নেওয়া রোগীর জন্য বেশি ঝুঁকিপূর্ণ.
 */
export const normalizeSeverity = (value) => {
  if (typeof value !== 'string') return SEVERITY.YELLOW; // string না হলে নিরাপদ default
  const clean = value.trim().toLowerCase(); // spacing + case পরিষ্কার করা হচ্ছে

  if (clean === 'red' || clean === 'urgent' || clean === '2') return SEVERITY.RED; // Red-এর সব রূপ
  if (clean === 'yellow' || clean === 'needs_review' || clean === '1') return SEVERITY.YELLOW; // Yellow-এর সব রূপ
  if (clean === 'green' || clean === 'routine' || clean === '0') return SEVERITY.GREEN; // Green-এর সব রূপ

  return SEVERITY.YELLOW; // অচেনা label = নিরাপদ দিকে ঝুঁকে থাকা
};

// কোনো severity বৈধ কিনা তা যাচাই করার ছোট helper
export const isValidSeverity = (value) =>
  Object.values(SEVERITY).includes(String(value).toLowerCase()); // তিনটির একটির সাথে মিললে true

// দুইটি label-এর মধ্যে কোনটি বেশি জরুরি সেটি ফেরত দেয় (safety-net override-এ কাজে লাগে)
export const higherSeverity = (a, b) => {
  const first = normalizeSeverity(a); // প্রথম label normalize
  const second = normalizeSeverity(b); // দ্বিতীয় label normalize
  return SEVERITY_PRIORITY[first] >= SEVERITY_PRIORITY[second] ? first : second; // বড় priority জেতে
};
