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

Run the logic tests without a database:

```bash
npm run selftest         # triage pipeline — 8 clinical cases + determinism guard
npm run selftest:queue   # pagination, priority ordering, rate limiting
```

Work with the ML service (Week 6):

```bash
npm run mock:ml          # start a mock ML service on port 5001
npm run check:ml         # check whatever is at ML_SERVICE_URL against the contract
```

The mock implements `docs/ML_SERVICE_CONTRACT.md`, so the success path of the
ML integration can be tested before the Flask service exists. `check:ml` works
against the mock or the real service without knowing which.

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

`GET /patients` also accepts `?page=` and `?limit=` (Week 5). Pagination is
opt-in: without `?page=` the endpoint returns a bare array exactly as before,
so nothing that already consumes it breaks. With `?page=` it returns
`{ data, meta }`. Page totals are always available in the `X-Total-Count`,
`X-Page`, `X-Page-Size` and `X-Total-Pages` response headers.

### Notifications — `/api/notifications` *(all routes: staff only)*

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/` | My alerts — `?unread=true`, `?page=`, `?limit=` |
| GET | `/unread-count` | Badge counts: `{ unread, urgentUnread }` |
| PUT | `/read-all` | Mark all of my alerts read |
| PUT | `/:id/read` | Mark one alert read |

A Red case raises one notification per staff member, so each person keeps
their own read state. Repeated Red messages in the same session do not create
duplicates while an unread alert for that case already exists.

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
| `ML_RETRY_ATTEMPTS` | `1` | Retries on a transient ML failure |
| `ML_BREAKER_THRESHOLD` | `5` | Consecutive failures before the breaker opens |
| `ML_BREAKER_COOLDOWN_MS` | `30000` | How long the breaker stays open |
| `RATE_LIMIT_DISABLED` | unset | Set to `true` to switch off login rate limiting |

## 7. Status

Completed this week (Week 3):
hybrid triage pipeline, safety-net layer, ML client with graceful fallback, audit fields on
`PatientTriage`, `StaffAction` audit collection, priority queue with filters, stats endpoint,
route protection and ownership checks, request validation, centralised error handling,
self-test script, API documentation.

Completed in Week 5:
staff notification collection with per-recipient read state, opt-in pagination on
the patient queue, database-level priority ordering, and rate limiting on the
authentication endpoints.

Completed in Week 6:
frozen ML service contract (`docs/ML_SERVICE_CONTRACT.md`), a mock ML service so
the integration path can be tested before the Flask model exists, a contract
compliance checker, and a hardened ML client with response validation, retry and
a circuit breaker.

Remaining:
notification collection and staff alerting, pagination on the queue, integration with the real
Flask model once trained, rate limiting, deployment configuration.
