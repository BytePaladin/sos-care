# S.O.S. Care — Backend API

CSE299 Junior Design · **Backend module — Sk. Arif Bin Ekram (2311695042)**

Express + MongoDB REST API for the S.O.S. (Symptom Optimized Screener) kidney-triage system.
The backend receives patient messages, calls the Flask ML microservice, applies the
**deterministic rule-based safety net**, stores the final severity, and serves the
priority-ordered queue to the doctor/staff dashboard.

---

## 1. Requirements

| Item | Version |
| --- | --- |
| Node.js | **18 or newer** (built-in `fetch` is used, so no `axios` dependency) |
| MongoDB | local `mongod` **or** a free MongoDB Atlas cluster |
| Flask ML service | optional — backend falls back gracefully if it is offline |

## 2. Setup

```bash
cd server
npm install
cp .env.example .env      # then edit .env with your own values
npm run seed              # optional: load demo users + triage records
npm run dev               # starts on http://localhost:5000
```

Run the triage logic test without a database:

```bash
npm run selftest
```

## 3. Severity pipeline (Proposal §8, Figure 2)

```
patient message
      │
      ├──────────────► Flask ML service  ──►  mlLabel        (green | yellow | red)
      │                (offline → deterministic fallback heuristic)
      │
      └──────────────► safety-net rules  ──►  ruleOverride   (true | false)
                                              matchedKeywords

      finalLabel = RED           if ruleOverride === true
      finalLabel = mlLabel       otherwise
```

The override is **deterministic** — no probability, no randomness. An explicitly dangerous
message is escalated even when the classifier is wrong or the ML service is down.

Active safety-net rules: `ANURIA`, `BREATHING`, `CHEST_PAIN`, `BLEEDING`,
`LOSS_OF_CONSCIOUSNESS`, `SEVERE_CONFUSION`, `SEIZURE`.

Two extra guarantees implemented in the backend:

* **Escalate-only** — once a triage record reaches RED it is never downgraded by a later
  routine message in the same session.
* **Fail-safe normalisation** — an unrecognised label from the ML service becomes
  `yellow` (needs review), never `green`.

## 4. API reference

Base URL: `http://localhost:5000/api` (Vite proxies `/api` to this in development).
Protected routes need `Authorization: Bearer <token>`.

### Auth — `/api/auth`

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/register` | public | Register a patient |
| POST | `/login` | public | Log in, returns JWT |
| GET | `/me` | logged in | Current user profile |
| PUT | `/telegram` | staff | Update Telegram alert settings |
| GET | `/staff` | staff | List staff members (for forwarding) |

### Chats — `/api/chats`

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/` | optional auth | Create a screening session + triage record |
| POST | `/:id/messages` | owner or staff | Submit a message, run hybrid triage |
| GET | `/:id` | owner or staff | Full session |
| GET | `/my-chats` | logged in | The patient's own sessions |

### Triage — `/api/triage` *(all routes: staff only)*

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/patients` | Priority queue — **Red → Yellow → Green**, pending first |
| GET | `/stats` | Dashboard counters (single aggregation query) |
| PUT | `/patients/:id/status` | Update review status / forward to a colleague |
| POST | `/patients/:id/notes` | Add a clinical note |
| GET | `/patients/:id/actions` | Staff audit trail for one patient |

`GET /patients` accepts optional filters:
`?severity=red|yellow|green`, `?status=pending|contacted|false_positive|needs_review`,
`?search=<name or phone>`, `?since=<ISO date>`, `?limit=<n>` (max 500).

### Health

`GET /api/health` reports server status, whether the ML service is reachable, and how many
safety-net rules are loaded.

## 5. Error format

Every error returns the same shape, so the frontend can always read `.message`:

```json
{ "message": "Missing required field(s): text" }
```

| Status | Meaning |
| --- | --- |
| 400 | Validation failed (missing field, bad ObjectId, text too long) |
| 401 | No token / invalid token / expired session |
| 403 | Logged in but not allowed (not staff, or not the session owner) |
| 404 | Route or resource not found |
| 409 | Duplicate record (e.g. phone already registered) |
| 500 | Unexpected server error |

## 6. Environment variables

See `.env.example`. `.env` is git-ignored and must never be committed.

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `5000` | Vite dev proxy expects 5000 |
| `MONGODB_URI` | local mongo | Atlas free tier works |
| `JWT_SECRET` | dev fallback | **must** be set outside development |
| `ML_SERVICE_URL` | `http://127.0.0.1:5001` | Flask microservice |
| `ML_TIMEOUT_MS` | `4000` | Falls back to heuristic after this |

## 7. Status

Completed this week (Week 3):
hybrid triage pipeline, safety-net layer, ML client with graceful fallback, audit fields on
`PatientTriage`, `StaffAction` audit collection, priority queue with filters, stats endpoint,
route protection and ownership checks, request validation, centralised error handling,
self-test script, API documentation.

Remaining (Weeks 4–7):
notification collection and staff alerting, pagination on the queue, integration with the real
Flask model once trained, rate limiting, deployment configuration.
