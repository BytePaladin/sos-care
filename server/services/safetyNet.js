/**
 * safetyNet.js
 * --------------------------------------------------------------------------
 * Deterministic Rule-Based Safety-Net Layer (Proposal Section 8, Figure 2)
 *
 * এই layer টাই প্রজেক্টের core safety design. ML model ভুল করলেও
 * স্পষ্টভাবে বিপজ্জনক phrase থাকলে message জোর করে RED করা হয়.
 * এখানে কোনো randomness বা probability নেই — সম্পূর্ণ deterministic.
 * --------------------------------------------------------------------------
 */

// Proposal Appendix B অনুযায়ী critical phrase গুলো, প্রতিটির একটি clinical tag আছে
const CRITICAL_RULES = [
  {
    tag: 'ANURIA', // প্রস্রাব বন্ধ — kidney patient-এর জন্য সবচেয়ে জরুরি সংকেত
    patterns: [
      /\bno urine\b/i, // "no urine"
      /\bnot? (?:passed|passing|urinated)\b[^.!?]{0,20}\burine\b/i, // "not passed any urine"
      /\bcan(?:'|’)?t (?:pass|make|produce)\b[^.!?]{0,10}\burine\b/i, // "can't pass urine"
      /\bcannot (?:pass|urinate)\b/i, // "cannot urinate"
      /\bhaven(?:'|’)?t (?:passed|urinated)\b/i, // "haven't urinated"
      /\banuria\b/i, // clinical term
      /প্রস্রাব হচ্ছে না/, // বাংলা ইনপুট support
    ],
  },
  {
    tag: 'BREATHING', // শ্বাসকষ্ট — fluid overload-এর জরুরি লক্ষণ
    patterns: [
      /\bcan(?:'|’)?t breathe\b/i, // "can't breathe"
      /\bcannot breathe\b/i, // "cannot breathe"
      /\b(?:difficulty|trouble|struggling) (?:in )?breathing\b/i, // "difficulty breathing"
      /\bshort(?:ness)? of breath\b/i, // "shortness of breath"
      /শ্বাস নিতে কষ্ট|দম বন্ধ/, // বাংলা ইনপুট support
    ],
  },
  {
    tag: 'CHEST_PAIN', // বুকে ব্যথা — cardiac/electrolyte জটিলতা
    patterns: [
      /\bchest pain\b/i, // "chest pain"
      /\bpain in (?:my )?chest\b/i, // "pain in my chest"
      /\bchest (?:tightness|pressure)\b/i, // "chest tightness"
      /বুকে ব্যথা/, // বাংলা ইনপুট support
    ],
  },
  {
    tag: 'BLEEDING', // অনিয়ন্ত্রিত রক্তপাত
    patterns: [
      /\buncontrolled bleeding\b/i, // "uncontrolled bleeding"
      /\bbleeding (?:heavily|a lot|non ?stop)\b/i, // "bleeding heavily"
      /\bwon(?:'|’)?t stop bleeding\b/i, // "won't stop bleeding"
      /\bblood (?:in|with) (?:my )?(?:urine|vomit)\b/i, // "blood in my urine"
      /রক্ত পড়ছে|রক্তক্ষরণ/, // বাংলা ইনপুট support
    ],
  },
  {
    tag: 'LOSS_OF_CONSCIOUSNESS', // জ্ঞান হারানো
    patterns: [
      /\bfainted\b/i, // "fainted"
      /\bpassed out\b/i, // "passed out"
      /\blost consciousness\b/i, // "lost consciousness"
      /\bunconscious\b/i, // "unconscious"
      /জ্ঞান হারিয়ে|অজ্ঞান/, // বাংলা ইনপুট support
    ],
  },
  {
    tag: 'SEVERE_CONFUSION', // তীব্র বিভ্রান্তি — uremia-র লক্ষণ হতে পারে
    patterns: [
      /\bsevere(?:ly)? confus(?:ed|ion)\b/i, // "severe confusion"
      /\bnot making sense\b/i, // "not making sense"
      /\bcan(?:'|’)?t (?:think|recogni[sz]e)\b/i, // "can't recognize"
    ],
  },
  {
    tag: 'SEIZURE', // খিঁচুনি
    patterns: [
      /\bseizure\b/i, // "seizure"
      /\bconvulsion\b/i, // "convulsion"
      /\bhaving a fit\b/i, // "having a fit"
    ],
  },
];

/**
 * message টিকে rule engine-এ চালানো হয়.
 * @param {string} text — রোগীর লেখা raw message
 * @returns {{ triggered: boolean, matchedKeywords: string[] }}
 */
export const runSafetyNet = (text) => {
  // input string না হলে কিছুই match করানো যাবে না — নিরাপদে খালি ফল
  if (typeof text !== 'string' || !text.trim()) {
    return { triggered: false, matchedKeywords: [] }; // কোনো keyword পাওয়া যায়নি
  }

  const normalized = text.replace(/\s+/g, ' ').trim(); // একাধিক space কে একটিতে আনা হচ্ছে
  const matchedKeywords = []; // যেসব rule tag hit করেছে সেগুলো এখানে জমবে

  // প্রতিটি critical rule ধরে ধরে যাচাই করা হচ্ছে
  for (const rule of CRITICAL_RULES) {
    // rule-এর যেকোনো একটি pattern মিললেই সেই tag ধরা হবে
    const hit = rule.patterns.some((pattern) => pattern.test(normalized));
    if (hit) matchedKeywords.push(rule.tag); // tag তালিকায় যোগ
  }

  return {
    triggered: matchedKeywords.length > 0, // অন্তত একটি hit থাকলে override চালু
    matchedKeywords, // audit trail-এ কোন কারণে escalate হলো তা রাখা হবে
  };
};

// report/demo-তে দেখানোর জন্য কতগুলো rule আছে তা জানার helper
export const getSafetyNetRuleTags = () => CRITICAL_RULES.map((rule) => rule.tag); // শুধু tag নাম
