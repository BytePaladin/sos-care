/**
 * safetyNet.js
 * --------------------------------------------------------------------------
 * Deterministic Rule-Based Safety-Net Layer (Proposal Section 8, Figure 2)
 *
 * This layer is the core safety design of the project. Even if the ML model makes a mistake,
 * if there are explicitly dangerous phrases, the message is forced to RED.
 * There is no randomness or probability here — it is completely deterministic.
 * --------------------------------------------------------------------------
 */

// Critical phrases according to Proposal Appendix B, each has a clinical tag
const CRITICAL_RULES = [
  {
    tag: 'ANURIA', // Anuria — the most urgent signal for a kidney patient
    patterns: [
      /\bno urine\b/i, // "no urine"
      /\bnot? (?:passed|passing|urinated)\b[^.!?]{0,20}\burine\b/i, // "not passed any urine"
      /\bcan(?:'|’)?t (?:pass|make|produce)\b[^.!?]{0,10}\burine\b/i, // "can't pass urine"
      /\bcannot (?:pass|urinate)\b/i, // "cannot urinate"
      /\bhaven(?:'|’)?t (?:passed|urinated)\b/i, // "haven't urinated"
      /\banuria\b/i, // clinical term
    ],
  },
  {
    tag: 'BREATHING', // Shortness of breath — urgent sign of fluid overload
    patterns: [
      /\bcan(?:'|’)?t breathe\b/i, // "can't breathe"
      /\bcannot breathe\b/i, // "cannot breathe"
      /\b(?:difficulty|trouble|struggling) (?:in )?breathing\b/i, // "difficulty breathing"
      /\bshort(?:ness)? of breath\b/i, // "shortness of breath"
    ],
  },
  {
    tag: 'CHEST_PAIN', // Chest pain — cardiac/electrolyte complication
    patterns: [
      /\bchest pain\b/i, // "chest pain"
      /\bpain in (?:my )?chest\b/i, // "pain in my chest"
      /\bchest (?:tightness|pressure)\b/i, // "chest tightness"
    ],
  },
  {
    tag: 'BLEEDING', // Uncontrolled bleeding
    patterns: [
      /\buncontrolled bleeding\b/i, // "uncontrolled bleeding"
      /\bbleeding (?:heavily|a lot|non ?stop)\b/i, // "bleeding heavily"
      /\bwon(?:'|’)?t stop bleeding\b/i, // "won't stop bleeding"
      /\bblood (?:in|with) (?:my )?(?:urine|vomit)\b/i, // "blood in my urine"
    ],
  },
  {
    tag: 'LOSS_OF_CONSCIOUSNESS', // Loss of consciousness
    patterns: [
      /\bfainted\b/i, // "fainted"
      /\bpassed out\b/i, // "passed out"
      /\blost consciousness\b/i, // "lost consciousness"
      /\bunconscious\b/i, // "unconscious"
    ],
  },
  {
    tag: 'SEVERE_CONFUSION', // Severe confusion — might be a sign of uremia
    patterns: [
      /\bsevere(?:ly)? confus(?:ed|ion)\b/i, // "severe confusion"
      /\bnot making sense\b/i, // "not making sense"
      /\bcan(?:'|’)?t (?:think|recogni[sz]e)\b/i, // "can't recognize"
    ],
  },
  {
    tag: 'SEIZURE', // Seizure
    patterns: [
      /\bseizure\b/i, // "seizure"
      /\bconvulsion\b/i, // "convulsion"
      /\bhaving a fit\b/i, // "having a fit"
    ],
  },
];

/**
 * Runs the message through the rule engine.
 * @param {string} text — Patient's raw message
 * @returns {{ triggered: boolean, matchedKeywords: string[] }}
 */
export const runSafetyNet = (text) => {
  // If it's not a valid input string, safely return empty result
  if (typeof text !== 'string' || !text.trim()) {
    return { triggered: false, matchedKeywords: [] }; // no keyword found
  }

  const normalized = text.replace(/\s+/g, ' ').trim(); // normalize multiple spaces to one
  const matchedKeywords = []; // rule tags that hit will be accumulated here

  // Evaluate against each critical rule
  for (const rule of CRITICAL_RULES) {
    // If any pattern of the rule matches, capture the tag
    const hit = rule.patterns.some((pattern) => pattern.test(normalized));
    if (hit) matchedKeywords.push(rule.tag); // add tag to the list
  }

  return {
    triggered: matchedKeywords.length > 0, // enable override if at least one hit
    matchedKeywords, // store the reason for escalation in audit trail
  };
};

// Helper to check how many rules are loaded (for report/demo)
export const getSafetyNetRuleTags = () => CRITICAL_RULES.map((rule) => rule.tag); // just tag names
