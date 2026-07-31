/**
 * triage-selftest.js
 * Small script to verify triage logic without MongoDB.
 * Run: npm run selftest
 *
 * Purpose: To prove that the safety-net override really works —
 * this can be shown in weekly progress reports and demos.
 */

import { runSafetyNet, getSafetyNetRuleTags } from '../services/safetyNet.js'; // rule engine
import { evaluateMessage } from '../services/triageEngine.js'; // hybrid engine
import { normalizeSeverity, higherSeverity } from '../utils/severity.js'; // helper

// Sample messages for testing — taken from Appendix A of the proposal
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

// A small test runner — no test library needed
const run = async () => {
  console.log(`\n=== S.O.S. Triage Self-Test ===`); // Title
  console.log(`Safety-net rules loaded: ${getSafetyNetRuleTags().join(', ')}\n`); // Which rules are there

  let passed = 0; // How many passed
  let failed = 0; // How many failed

  // Running each case individually
  for (const testCase of CASES) {
    const safety = runSafetyNet(testCase.text); // Just the rule engine
    const decision = await evaluateMessage(testCase.text); // Full hybrid decision

    const gotRed = decision.finalLabel === 'red'; // Is the result red
    const ok = gotRed === testCase.expectRed; // Did it match expectations

    if (ok) passed += 1; // Count pass
    else failed += 1; // Count fail

    // Displaying each result in a readable format
    console.log(
      `${ok ? 'PASS' : 'FAIL'} | final=${decision.finalLabel.padEnd(6)} | ml=${decision.mlLabel.padEnd(6)} | override=${String(decision.ruleOverride).padEnd(5)} | rules=[${safety.matchedKeywords.join(',')}]`
    );
    console.log(`       "${testCase.text}"\n`); // Original message
  }

  // Small check for helpers
  console.assert(normalizeSeverity('RED ') === 'red', 'normalizeSeverity failed'); // case/space handling
  console.assert(higherSeverity('green', 'red') === 'red', 'higherSeverity failed'); // priority handling

  console.log(`Result: ${passed} passed, ${failed} failed.`); // Summary
  process.exit(failed > 0 ? 1 : 0); // Non-zero exit code if there is a failure
};

run(); // Start script
