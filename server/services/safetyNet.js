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
      // Week 5 (found by the parity test): the rule above only matched the
      // "-ing breathing" form, so "struggling to breathe" slipped through.
      /\b(?:struggling|straining|unable) to breathe\b/i, // "struggling to breathe"
      /\bcan(?:'|’)?t catch my breath\b/i, // "can't catch my breath"
      /\bgasping for (?:air|breath)\b/i, // "gasping for air"
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
      // Week 5 (found by the parity test): the reversed word order
      // "the bleeding won't stop" was not matched by the rule above.
      /\bbleeding (?:that )?won(?:'|’)?t stop\b/i, // "the bleeding won't stop"
      /\bcan(?:'|’)?t stop (?:the )?bleeding\b/i, // "can't stop the bleeding"
      /\bblood (?:in|with) (?:my )?(?:urine|vomit)\b/i, // "blood in my urine"
      // Week 5: widened to match ml/safety_net.py, which caught phrasings this
      // rule missed — "blood is coming through my urine", "I've been peeing
      // blood", "my urine has blood". Visible blood for a kidney patient is
      // treated as critical regardless of how it is worded.
      /\bblood (?:is |was )?(?:coming )?(?:through|out of|out with)\b[^.!?]{0,12}\b(?:urine|pee)\b/i,
      /\b(?:urine|pee) (?:has|had|with|that has)\b[^.!?]{0,10}\bblood\b/i,
      /\b(?:peeing|pissing|urinating) blood\b/i,
      /\bcoughing up blood\b/i, // haemoptysis
      /\b(?:vomiting|throwing up) blood\b/i, // haematemesis
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
  {
    // Added in Week 5 to match ml/safety_net.py, which gained this rule during
    // Week 3 error analysis: the classifier labelled "sudden severe headache,
    // the worst one of my life" as GREEN. A thunderclap headache is a red flag
    // for subarachnoid haemorrhage or hypertensive emergency, so it is escalated
    // deterministically rather than left to the model.
    // Note the deliberate narrowness: a plain "headache" is a Yellow-level
    // symptom and must NOT trigger here, or the queue fills with false REDs.
    tag: 'THUNDERCLAP_HEADACHE',
    patterns: [
      /\bworst headache (?:of|in) my life\b/i, // "worst headache of my life"
      /\bworst headache i(?:'|’)?ve ever had\b/i, // "worst headache I've ever had"
      /\bsudden(?:ly)? severe headache\b/i, // "sudden severe headache"
      /\bthunderclap headache\b/i, // the clinical term
    ],
  },

  // ── Colloquial phrasings (v4) ───────────────────────────────────────────
  // Evaluating the model on hand-written messages showed these rules were
  // written in clinical register and missed ordinary patient language for the
  // same emergencies — "chest pain" was caught, "a weight on my chest" was not.
  // These stay deliberately narrow: "pee stopped" is anuria, but "peeing less"
  // is a watch-level symptom and must stay YELLOW rather than being swept into
  // RED. Mirrored in ml/safety_net.py and pinned by the parity test.
  {
    tag: 'ANURIA_LAY',
    patterns: [
      /\b(?:pee|wee|urine|water)\s*(?:has |have )?(?:completely |totally )?stopped\b/i,
      /\bstopped (?:peeing|weeing|passing water)\b/i,
      /\bnothing (?:comes|came|will come) out\b[^.!?]{0,25}\b(?:pee|wee|toilet|urinate|bladder)\b/i,
      /\bno wee\b/i,
      /\bcan(?:'|’)?t (?:pee|wee)\b/i,
      /\bcannot (?:pee|wee)\b/i,
      /\bhaven(?:'|’)?t (?:been able to )?(?:pee|wee|go for a wee)\b/i,
      /\bwater works have stopped\b/i,
      /\bcannot empty my bladder\b/i,
    ],
  },
  {
    tag: 'BREATHING_LAY',
    patterns: [
      /\bcan(?:'|’)?t (?:get|catch|take) (?:a |my |enough )?(?:full )?breath\b/i,
      /\bcan(?:'|’)?t get enough air\b/i,
      /\bfighting for air\b/i,
      /\bstruggling (?:to get|for) (?:my )?breath\b/i,
      /\bout of breath\b[^.!?]{0,20}\b(?:sitting|resting|still|lying)\b/i,
      /\bbreathless\b[^.!?]{0,25}\b(?:sitting|resting|still|room|door)\b/i,
    ],
  },
  {
    tag: 'CHEST_PAIN_LAY',
    patterns: [
      /\b(?:heavy|heaviness|weight|tight band|band)\b[^.!?]{0,20}\b(?:on|across|around|in) (?:my )?chest\b/i,
      /\bchest feels (?:squeezed|crushed|tight and heavy|heavy)\b/i,
      /\bpressure across (?:my )?chest\b/i,
      /\bpain (?:across|in) (?:my )?chest\b[^.!?]{0,25}\b(?:jaw|arm|shoulder)\b/i,
      /\bspreading (?:up )?to my (?:jaw|arm)\b/i,
    ],
  },
  {
    tag: 'BLOOD_IN_URINE_LAY',
    patterns: [
      /\bred in the toilet\b/i,
      /\btoilet water went red\b/i,
      /\bdark red\b[^.!?]{0,15}\b(?:urine|pee|water)\b/i,
      /\bclots\b[^.!?]{0,25}\b(?:pee|urine|pass water|passing water)\b/i,
      /\burine is the colour of blood\b/i,
    ],
  },
  {
    tag: 'VOMITING_BLOOD_LAY',
    patterns: [
      /\bcoffee grounds?\b/i,
      /\bbrought up\b[^.!?]{0,25}\bblood\b/i,
      /\blike old blood\b/i,
    ],
  },
  {
    tag: 'COLLAPSE_LAY',
    patterns: [
      /\bkeeled over\b/i,
      /\bcame round on the floor\b/i,
      /\bI collapsed\b/i,
      /\bfound me\b[^.!?]{0,20}\b(?:shaking|unresponsive)\b/i,
      /\bwas unresponsive\b/i,
    ],
  },

  // ── Bengali rules (Week 5) ──────────────────────────────────────────────
  // Patients at a Bangladeshi kidney hospital write in Bengali. An
  // English-only safety net would silently fail to escalate them, which is
  // exactly the failure this layer exists to prevent. These mirror the English
  // rules above and are pinned against ml/safety_net.py by the parity test
  // (ml/tests/test_safety_net_parity.py). Note: \b word boundaries do not work
  // on Bengali script, so these patterns match without them.
  {
    tag: 'ANURIA_BN',
    patterns: [
      /প্রস্রাব হচ্ছে না/, // "no urine is coming"
      /প্রস্রাব হয়নি/, // "urine has not happened"
      /প্রস্রাব বন্ধ/, // "urine stopped"
      /প্রস্রাব করতে পারছি না/, // "cannot pass urine"
      /পেশাব হচ্ছে না/, // colloquial variant
    ],
  },
  {
    tag: 'BREATHING_BN',
    patterns: [
      /শ্বাস নিতে কষ্ট/, // "difficulty breathing"
      /শ্বাসকষ্ট/, // "breathlessness"
      /দম বন্ধ/, // "can't breathe"
      /নিঃশ্বাস নিতে পারছি না/, // "cannot take a breath"
    ],
  },
  {
    tag: 'CHEST_PAIN_BN',
    patterns: [
      /বুকে ব্যথা/, // "chest pain"
      /বুকে চাপ/, // "chest pressure"
      /বুক ব্যথা/, // variant spacing
    ],
  },
  {
    tag: 'BLEEDING_BN',
    patterns: [
      /প্রস্রাবে রক্ত/, // "blood in urine"
      /প্রস্রাবের সাথে রক্ত/, // "blood with urine"
      /রক্ত যাচ্ছে/, // "blood is passing"
      /রক্ত বমি/, // "vomiting blood"
      /রক্তপাত বন্ধ হচ্ছে না/, // "bleeding won't stop"
    ],
  },
  {
    tag: 'LOSS_OF_CONSCIOUSNESS_BN',
    patterns: [
      /জ্ঞান হারি/, // "lost consciousness"
      /অজ্ঞান/, // "unconscious"
      /সংজ্ঞা হারি/, // formal variant
    ],
  },
  {
    tag: 'SEIZURE_BN',
    patterns: [/খিঁচুনি/], // "seizure/convulsion"
  },
  {
    tag: 'THUNDERCLAP_HEADACHE_BN',
    patterns: [
      /জীবনের সবচেয়ে (?:তীব্র|খারাপ) মাথাব্যথা/, // "worst headache of my life"
      /হঠাৎ তীব্র মাথাব্যথা/, // "sudden severe headache"
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
