/**
 * mock-ml-service.js
 * --------------------------------------------------------------------------
 * Week 6: a stand-in for the Flask ML microservice.
 *
 *   npm run mock:ml
 *
 * Why this exists. The backend's ML integration path — the request shape, the
 * timeout, the retry, the circuit breaker, the fallback — could not be
 * exercised at all while the Flask service did not exist. Every test ran
 * against an unreachable service, which only ever proved the failure path.
 *
 * This mock implements the v1 contract in docs/ML_SERVICE_CONTRACT.md, so the
 * success path can be tested now and the real service becomes a drop-in
 * replacement. It also serves as a specification by example for the ML
 * workstream: a Flask service that behaves like this needs no backend change.
 *
 * It is written with Node's built-in http module — no dependency, and no
 * Python needed to run it.
 *
 * Failure modes for testing, via query string:
 *   /predict?mode=slow      → 6 second delay (exercises the timeout)
 *   /predict?mode=error     → HTTP 500 (exercises retry + fallback)
 *   /predict?mode=garbage   → 200 with a body that is not a prediction
 *   /predict?mode=notjson   → 200 with a non-JSON body
 * --------------------------------------------------------------------------
 */

import http from 'http';

const PORT = Number(process.env.MOCK_ML_PORT || 5001);

/**
 * A small deterministic classifier standing in for the trained model.
 *
 * This is NOT the project's model and makes no claim to be one — it exists so
 * the integration path has something to talk to. The real classifier will be
 * TF-IDF plus logistic regression, trained on the constructed dataset.
 */
const classify = (text) => {
  const t = String(text).toLowerCase();

  const urgent = ['no urine', 'not passed', 'cannot breathe', "can't breathe", 'chest pain', 'fainted', 'passed out', 'bleeding'];
  const concerning = ['swelling', 'swollen', 'tired', 'fatigue', 'nausea', 'nauseous', 'vomit', 'fever', 'dizzy', 'weak', 'back pain'];

  if (urgent.some((k) => t.includes(k))) return { label: 'red', confidence: 0.91 };
  if (concerning.some((k) => t.includes(k))) return { label: 'yellow', confidence: 0.78 };
  return { label: 'green', confidence: 0.83 };
};

const sendJson = (res, status, payload) => {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const mode = url.searchParams.get('mode');

  // ── GET /health ──
  if (req.method === 'GET' && url.pathname === '/health') {
    return sendJson(res, 200, { status: 'ok', service: 'mock-ml', contract: 'v1' });
  }

  // ── POST /predict ──
  if (req.method === 'POST' && url.pathname === '/predict') {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) req.destroy(); // refuse absurd payloads
    });

    req.on('end', async () => {
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return sendJson(res, 400, { error: 'invalid JSON body' });
      }

      if (typeof parsed.text !== 'string' || !parsed.text.trim()) {
        return sendJson(res, 400, { error: 'field "text" is required' });
      }

      // ── deliberate failure modes for testing the backend's error paths ──
      if (mode === 'error') {
        console.log('[MockML] returning 500 (mode=error)');
        return sendJson(res, 500, { error: 'simulated model failure' });
      }

      if (mode === 'garbage') {
        console.log('[MockML] returning an invalid prediction (mode=garbage)');
        return sendJson(res, 200, { result: 'maybe urgent?', score: 'high' });
      }

      if (mode === 'notjson') {
        console.log('[MockML] returning a non-JSON body (mode=notjson)');
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        return res.end('this is not json');
      }

      if (mode === 'slow') {
        console.log('[MockML] delaying 6s (mode=slow)');
        await new Promise((r) => setTimeout(r, 6000));
      }

      const prediction = classify(parsed.text);
      console.log(`[MockML] "${parsed.text.slice(0, 45)}..." → ${prediction.label} (${prediction.confidence})`);

      return sendJson(res, 200, { ...prediction, model_version: 'mock-1.0' });
    });

    return undefined;
  }

  sendJson(res, 404, { error: 'not found' });
});

server.listen(PORT, () => {
  console.log(`\n[MockML] Mock ML service listening on http://127.0.0.1:${PORT}`);
  console.log('[MockML] Implements docs/ML_SERVICE_CONTRACT.md v1');
  console.log('[MockML] POST /predict   ·   GET /health');
  console.log('[MockML] Failure modes:  ?mode=slow | error | garbage | notjson');
  console.log('[MockML] Stop with Ctrl+C\n');
});
