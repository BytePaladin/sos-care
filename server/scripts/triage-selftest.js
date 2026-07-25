/**
 * triage-selftest.js
 * MongoDB ছাড়াই triage logic যাচাই করার ছোট script.
 * চালান:  npm run selftest
 *
 * উদ্দেশ্য: safety-net override সত্যিই কাজ করছে কিনা তা প্রমাণ করা —
 * weekly progress report ও demo-তে এটি দেখানো যাবে.
 */

import { runSafetyNet, getSafetyNetRuleTags } from '../services/safetyNet.js'; // rule engine
import { evaluateMessage } from '../services/triageEngine.js'; // hybrid engine
import { normalizeSeverity, higherSeverity } from '../utils/severity.js'; // helper

// পরীক্ষা করার জন্য নমুনা message — proposal-এর Appendix A থেকে নেওয়া
const CASES = [
  { text: 'I have not passed any urine since yesterday', expectRed: true }, // ANURIA
  { text: "I can't breathe properly and my chest feels tight", expectRed: true }, // BREATHING + CHEST
  { text: 'There is blood in my urine and it will not stop', expectRed: true }, // BLEEDING
  { text: 'My father fainted this morning', expectRed: true }, // LOSS_OF_CONSCIOUSNESS
  { text: 'My legs and ankles have been swelling more for two days', expectRed: false }, // Yellow
  { text: 'I feel very tired and a bit nauseous after my new medicine', expectRed: false }, // Yellow
  { text: 'Can I eat bananas on my current diet?', expectRed: false }, // Green
  { text: 'I need to reschedule my appointment next week', expectRed: false }, // Green
];

// একটি ছোট test runner — কোনো test library লাগছে না
const run = async () => {
  console.log(`\n=== S.O.S. Triage Self-Test ===`); // শিরোনাম
  console.log(`Safety-net rules loaded: ${getSafetyNetRuleTags().join(', ')}\n`); // কোন rule আছে

  let passed = 0; // কতগুলো পাস করল
  let failed = 0; // কতগুলো ব্যর্থ

  // প্রতিটি case ধরে ধরে চালানো হচ্ছে
  for (const testCase of CASES) {
    const safety = runSafetyNet(testCase.text); // শুধু rule engine
    const decision = await evaluateMessage(testCase.text); // পূর্ণ hybrid সিদ্ধান্ত

    const gotRed = decision.finalLabel === 'red'; // ফলাফল red কিনা
    const ok = gotRed === testCase.expectRed; // প্রত্যাশার সাথে মিলল কিনা

    if (ok) passed += 1; // পাস গণনা
    else failed += 1; // ব্যর্থ গণনা

    // প্রতিটি ফলাফল পড়ার মতো করে দেখানো হচ্ছে
    console.log(
      `${ok ? 'PASS' : 'FAIL'} | final=${decision.finalLabel.padEnd(6)} | ml=${decision.mlLabel.padEnd(6)} | override=${String(decision.ruleOverride).padEnd(5)} | rules=[${safety.matchedKeywords.join(',')}]`
    );
    console.log(`       "${testCase.text}"\n`); // মূল message
  }

  // helper গুলোর ছোট যাচাই
  console.assert(normalizeSeverity('RED ') === 'red', 'normalizeSeverity failed'); // case/space handling
  console.assert(higherSeverity('green', 'red') === 'red', 'higherSeverity failed'); // priority handling

  console.log(`Result: ${passed} passed, ${failed} failed.`); // সারাংশ
  process.exit(failed > 0 ? 1 : 0); // ব্যর্থ থাকলে non-zero exit code
};

run(); // script চালু
