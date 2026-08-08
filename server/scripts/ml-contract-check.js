/**
 * ml-contract-check.js
 * --------------------------------------------------------------------------
 * Week 6: checks whatever is running at ML_SERVICE_URL against the v1 contract.
 *
 *   npm run check:ml
 *
 * Point it at the mock (npm run mock:ml) or at the real Flask service — it
 * does not know or care which. It reports whether the responses satisfy
 * docs/ML_SERVICE_CONTRACT.md, so the ML workstream can verify an
 * implementation before integration rather than during it.
 *
 * Exits non-zero if any required check fails, so it can be used as a gate.
 * --------------------------------------------------------------------------
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateMlResponse } from '../services/mlClient.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const URL_BASE = process.env.ML_SERVICE_URL || 'http://127.0.0.1:5001';
const TIMEOUT_BUDGET = Number(process.env.ML_TIMEOUT_MS || 4000);

let passed = 0;
let failed = 0;
let warned = 0;

const check = (name, ok, detail = '') => {
  if (ok) { passed += 1; console.log(`  PASS  ${name}`); }
  else { failed += 1; console.log(`  FAIL  ${name}${detail ? `  → ${detail}` : ''}`); }
};

const warn = (name, detail) => {
  warned += 1;
  console.log(`  WARN  ${name}${detail ? `  → ${detail}` : ''}`);
};

const post = async (text) => {
  const started = Date.now();
  const res = await fetch(`${URL_BASE}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(15000), // generous here — we measure and report
  });
  let body = null;
  try { body = await res.json(); } catch { /* reported by the caller */ }
  return { status: res.status, body, ms: Date.now() - started };
};

console.log(`\n=== ML Service Contract Check (v1) ===`);
console.log(`Target: ${URL_BASE}`);
console.log(`Timeout budget: ${TIMEOUT_BUDGET}ms\n`);

// ── 1. Reachability ───────────────────────────────────────────────────────
console.log('1. Reachability');

let healthOk = false;
try {
  const res = await fetch(`${URL_BASE}/health`, { signal: AbortSignal.timeout(3000) });
  healthOk = res.ok;
  check('GET /health returns 200', res.ok, `got ${res.status}`);
} catch (error) {
  check('GET /health returns 200', false, error.message);
}

if (!healthOk) {
  console.log('\n  Service is not reachable. Start it first:');
  console.log('    npm run mock:ml            (the built-in mock)');
  console.log('    python app.py              (the Flask service)\n');
  process.exit(1);
}

// ── 2. Contract compliance on real messages ───────────────────────────────
console.log('\n2. Prediction contract');

// Drawn from Appendix A of the proposal
const probes = [
  { text: 'I have not passed any urine since yesterday', expect: 'red' },
  { text: 'My legs and ankles have been swelling more for two days', expect: 'yellow' },
  { text: 'Can I eat bananas on my current diet?', expect: 'green' },
];

const latencies = [];

for (const probe of probes) {
  let result;
  try {
    result = await post(probe.text);
  } catch (error) {
    check(`POST /predict — "${probe.text.slice(0, 32)}..."`, false, error.message);
    continue;
  }

  latencies.push(result.ms);

  check(`200 for "${probe.text.slice(0, 32)}..."`, result.status === 200, `got ${result.status}`);

  if (result.status !== 200) continue;

  const validated = validateMlResponse(result.body);
  check(`  response satisfies the contract`, validated.ok, validated.ok ? '' : validated.reason);

  if (validated.ok) {
    console.log(`        label=${validated.label}  confidence=${validated.confidence}  ${result.ms}ms`);

    // Agreement with the proposal's own worked examples is informative but
    // not a contract requirement — a model may legitimately disagree, and the
    // safety net covers the urgent cases regardless. Reported as a warning.
    if (validated.label !== probe.expect) {
      warn(`  label differs from Appendix A`, `expected ${probe.expect}, got ${validated.label}`);
    }
  }
}

// ── 3. Latency against the timeout budget ─────────────────────────────────
console.log('\n3. Latency');

if (latencies.length > 0) {
  const slowest = Math.max(...latencies);
  const average = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
  console.log(`       average ${average}ms, slowest ${slowest}ms`);

  check('slowest response is within the timeout budget', slowest < TIMEOUT_BUDGET, `${slowest}ms vs ${TIMEOUT_BUDGET}ms`);

  if (slowest > TIMEOUT_BUDGET * 0.5) {
    warn('running close to the timeout', 'load the model at startup, not per request');
  }
}

// ── 4. Input handling ─────────────────────────────────────────────────────
console.log('\n4. Input handling');

try {
  const res = await fetch(`${URL_BASE}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}), // no text field
    signal: AbortSignal.timeout(5000),
  });
  // The contract's only requirement is that the service must not claim success
  // on a request it could not process
  check('a request with no text is not answered with 200', res.status !== 200, `got ${res.status}`);
} catch (error) {
  check('a request with no text is handled without crashing', false, error.message);
}

try {
  const long = 'swelling '.repeat(220); // ~2000 characters, the backend's ceiling
  const res = await post(long);
  check('a 2000-character message is accepted', res.status === 200, `got ${res.status}`);
} catch (error) {
  check('a 2000-character message is accepted', false, error.message);
}

// ── Summary ───────────────────────────────────────────────────────────────
console.log(`\nResult: ${passed} passed, ${failed} failed, ${warned} warnings.`);
console.log(
  failed === 0
    ? 'This service satisfies the v1 contract and is ready to integrate.\n'
    : 'This service does not yet satisfy the v1 contract — see docs/ML_SERVICE_CONTRACT.md\n'
);

process.exit(failed > 0 ? 1 : 0);
