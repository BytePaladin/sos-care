# S.O.S. — ML Service Contract (v1)

**Between:** the Node/Express backend (Arif) and the Flask ML microservice (Imtiaz)
**Status:** frozen for v1 — the backend is built against this and will not change unilaterally
**Last updated:** Week 6

This document exists so the Flask service can be written and tested against a fixed target rather than negotiated at integration time. If the model needs something this contract does not allow, the contract is amended first and both sides update together.

---

## 1. What the service is responsible for

The Flask service does exactly one thing: given a patient's free-text message, return a severity label and a confidence score.

It does **not**:

- apply the safety net — that is deterministic and lives in the backend, so a model bug can never disable it
- decide the final label — the backend applies the override rule from Figure 2 of the proposal
- write to the database — the service is stateless
- authenticate the patient — the backend does that before calling

Keeping the service stateless and unauthenticated is deliberate. It runs on localhost alongside the backend and is never exposed publicly, so it needs no session handling, and it can be restarted or replaced at any time without data loss.

---

## 2. Endpoints

### 2.1 `POST /predict`

**Request**

```http
POST /predict HTTP/1.1
Content-Type: application/json

{
  "text": "I have not passed any urine since yesterday"
}
```

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `text` | string | yes | 1–2000 characters. The backend has already trimmed it and rejected empty input. |

**Response — 200**

```json
{
  "label": "red",
  "confidence": 0.87
}
```

| Field | Type | Required | Accepted values |
| --- | --- | --- | --- |
| `label` | string | yes | `red`, `yellow`, `green` — lowercase preferred, but see §3 |
| `confidence` | number | no | 0.0 – 1.0. Missing is treated as 0. |
| `model_version` | string | no | Echoed into logs if present; useful when comparing runs |

**Error responses**

Any non-200 status causes the backend to fall back to its heuristic and record `modelSource: "fallback-heuristic"`. The service does not need to return a specific error shape — it simply must not return 200 with a body it does not mean.

### 2.2 `GET /health`

**Response — 200**

```json
{ "status": "ok" }
```

Only the status code is checked. The backend calls this from `GET /api/health` and reports the result to the dashboard, so a 200 here is what makes the dashboard show the model as online.

---

## 3. Tolerances the backend already handles

The ML workstream does not need to be defensive about these — the backend normalises them. They are listed so nobody spends time on problems that are already solved:

| The service sends | The backend stores |
| --- | --- |
| `"RED"`, `"Red "`, `"  red"` | `red` |
| `"urgent"` / `"critical"` | `red` |
| `"routine"` / `"low"` | `green` |
| `"needs_review"` / `"moderate"` | `yellow` |
| `"severity"` instead of `"label"` | read from either key |
| anything unrecognised | `yellow` — never `green` (see §4) |
| `confidence` missing or non-numeric | `0` |

---

## 4. Two rules the backend enforces regardless of what the model returns

These are not negotiable and are worth understanding before training, because they shape what the model actually needs to be good at.

**The safety net can only escalate, never de-escalate.** If a message contains a critical phrase, the final label is `red` even when the model returns `green` with high confidence. The model therefore does not need to be reliable on explicitly dangerous phrasing — that case is already covered deterministically. Its value is in the ambiguous middle ground.

**An unrecognised label becomes `yellow`, never `green`.** If the service returns something the backend does not understand, the case is queued for review rather than dismissed as routine. So a bug in the service degrades the system towards caution, not away from it.

---

## 5. Timeouts and failure behaviour

| Setting | Default | Environment variable |
| --- | --- | --- |
| Request timeout | 4000 ms | `ML_TIMEOUT_MS` |
| Service base URL | `http://127.0.0.1:5001` | `ML_SERVICE_URL` |
| Retry attempts | 1 retry on connection failure or 5xx | `ML_RETRY_ATTEMPTS` |
| Circuit breaker | opens after 5 consecutive failures, retries after 30 s | `ML_BREAKER_THRESHOLD`, `ML_BREAKER_COOLDOWN_MS` |

Practical implication: **the service must answer a single message in well under four seconds.** A TF-IDF and logistic-regression pipeline of the kind described in the proposal is far below this, but a model that loads weights from disk on every request would not be. Load the model once at Flask startup, not inside the request handler.

If the service is unreachable the backend does not error. It falls back to its own keyword heuristic, records `modelSource: "fallback-heuristic"`, and continues — so the system is usable at every stage of the ML workstream's development.

---

## 6. Testing before the real service exists

The backend ships a mock that implements this contract:

```bash
npm run mock:ml          # starts a mock ML service on port 5001
```

The mock returns labels using a small deterministic rule set, and supports query flags for testing failure paths:

| Flag | Effect |
| --- | --- |
| `?mode=slow` | delays 6 seconds, so the backend's timeout path can be exercised |
| `?mode=error` | returns 500, so the fallback path can be exercised |
| `?mode=garbage` | returns a malformed label, so normalisation can be exercised |

With the mock running, `GET /api/health` reports `mlService: "online"` and every triage decision records `modelSource: "ml-service"` — the same behaviour the real service will produce.

**For the ML workstream:** the mock is also a specification by example. A Flask service that passes the same checks is a drop-in replacement; no backend change will be needed.

---

## 7. Verifying an implementation

Once the Flask service is running, from the `server/` directory:

```bash
npm run check:ml
```

This sends a set of probe messages to whatever is at `ML_SERVICE_URL` and reports whether the responses satisfy this contract — status codes, response shape, label validity, and latency against the timeout budget. It is the fastest way to confirm an implementation is ready to integrate.

---

## 8. Not covered by v1

Deliberately out of scope, to be raised as a v2 amendment if needed:

- batch prediction (`POST /predict/batch`) — not required by the current chat flow, which classifies one message at a time
- returning per-class probabilities rather than a single confidence
- returning extracted symptom entities alongside the label
- authentication between backend and ML service — unnecessary while both run on localhost
