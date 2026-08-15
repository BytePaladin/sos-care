/**
 * safety-net-probe.js
 * --------------------------------------------------------------------------
 * Reads JSON messages on stdin, runs each through the backend safety net, and
 * writes the results as JSON to stdout. Nothing else.
 *
 * This exists so the ML workstream's parity test (ml/tests/test_safety_net_parity.py)
 * can ask the *real* JavaScript rules what they decide, rather than
 * reimplementing them in Python and testing a copy. The two safety nets are
 * deliberately separate implementations — this is what keeps them in agreement.
 *
 *   echo '["I have chest pain"]' | node scripts/safety-net-probe.js
 *   -> [{"text":"I have chest pain","triggered":true,"matchedKeywords":["CHEST_PAIN"]}]
 * --------------------------------------------------------------------------
 */

import { runSafetyNet } from '../services/safetyNet.js';

const readStdin = async () => {
  let raw = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) raw += chunk;
  return raw;
};

const main = async () => {
  const raw = await readStdin();

  let messages;
  try {
    messages = JSON.parse(raw);
  } catch (err) {
    console.error(`safety-net-probe: stdin was not valid JSON — ${err.message}`);
    process.exit(1);
  }

  if (!Array.isArray(messages)) {
    console.error('safety-net-probe: expected a JSON array of strings');
    process.exit(1);
  }

  const results = messages.map((text) => {
    const { triggered, matchedKeywords } = runSafetyNet(text);
    return { text, triggered, matchedKeywords };
  });

  process.stdout.write(JSON.stringify(results));
};

main();
