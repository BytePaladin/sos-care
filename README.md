# S.O.S. Care — Symptom Optimized Screener

[![Live Demo](https://img.shields.io/badge/demo-sos--care.vercel.app-brightgreen?style=flat-square)](https://sos-care.vercel.app)
[![Stack](https://img.shields.io/badge/stack-MERN%20%2B%20Flask%20ML-blue?style=flat-square)]()
[![Languages](https://img.shields.io/badge/languages-Bangla%20%7C%20English-orange?style=flat-square)]()
[![Urgency Triage](https://img.shields.io/badge/triage-Green%20%7C%20Yellow%20%7C%20Red-red?style=flat-square)]()



A patient writes how they feel, in their own words, in English or Bangla. The
system decides how urgently a clinician needs to see them — **GREEN** (routine),
**YELLOW** (needs review) or **RED** (urgent) — and the case appears on a triage
dashboard sorted by urgency, with the reason for its ranking shown alongside it.

Built for a kidney-care setting, where the cost of missing an urgent message is
far higher than the cost of reviewing a routine one. That asymmetry shapes every
design decision below.

> **Course project** — CSE299.12, Group *NextGent Trio*.
> Specification: [spec.md](spec.md) · Weekly plan: [plan.md](plan.md)

| Stream | Owner |
|---|---|
| Frontend | Mohd Salman Akther Khan Sabit |
| Backend & Database | Sk. Arif Bin Ekram |
| Machine Learning / AI | Mohammad Imtiaz Hassan |

---

## How a message is classified

```
Vite + React SPA  ──/api──▶  Express + MongoDB  ──/predict──▶  Flask ML service
   (port 5173)                  (port 5000)                      (port 5001)
```

The frontend never calls the ML service directly. Express owns the decision:

```
                    ┌─────────────────────┐
   patient message ─┤  ML classifier      ├─▶ green / yellow / red
                    └─────────────────────┘         │
                    ┌─────────────────────┐         ▼
                   ─┤  safety net (rules) ├─▶ RED ──┴──▶  final label
                    └─────────────────────┘
```

**The safety net can only escalate, never downgrade.** It is deterministic
keyword matching that runs independently of the model, so a classifier failure
can never suppress an explicitly dangerous message. Both the raw model label and
the final label are stored, so any decision can be audited afterwards.

This is not a formality. On hand-written messages the model had never seen, the
classifier alone catches 68% of urgent cases; with the safety net the system
catches **82%**. The rule layer is what makes the result trustworthy, and it is
measurable rather than assumed — see
[ml/models/VALIDATION.md](ml/models/VALIDATION.md).

---

## Quick start

**Prerequisites:** Node.js 18+ and Python 3.10+.

```bash
npm install
cd server && npm install && cd ..
cd ml && pip install -r requirements.txt && cd ..
```

The trained model is gitignored (it is regenerable), so build it once:

```bash
cd ml && python training/train.py --data dataset_v4.csv && cd ..
```

Then run three terminals:

```bash
cd ml && python app.py
```

```bash
cd server && npm run dev
```

```bash
npm run dev
```

Open **http://localhost:5173**. Wait for the backend to print `[Seed] Success!`
before signing in — it takes a few seconds to start the database and seed it.

### No database setup needed

If `MONGODB_URI` is unset, the backend starts an **in-memory MongoDB** and seeds
demo data automatically — no `mongod` install, no Atlas account. The data resets
on every restart, which is what you want for a demo.

For a real database, copy [server/.env.example](server/.env.example) to
`server/.env`, set `MONGODB_URI`, and run `cd server && npm run seed` once.

### Demo accounts

| Role | Phone | Password |
|---|---|---|
| Patient | `01700000000` | `Demo@1234` |
| Staff — Dr. Nusrat Jahan | `01800000000` | `Staff@1234` |
| Staff — Dr. Tanvir Ahmed | `01900000000` | `Staff@1234` |
| Admin — Dr. Rafiqul Islam | `01711112222` | `admin123` |

Demo credentials only. Seeded by [server/seed.js](server/seed.js).

---

## Try it

Sign in as the patient and send each of these in a **new chat**:

| Message | Expected |
|---|---|
| `Can I eat bananas on my current diet?` | GREEN |
| `My legs and ankles have been swelling for two days` | YELLOW |
| `I haven't passed any urine since yesterday` | RED — safety net fires |
| `theres a heavy weight sitting on my chest` | RED — colloquial phrasing |
| `বুকে ব্যথা করছে` | RED — Bangla |

Then sign in as staff and open a RED case. The **"Why this ranking"** panel shows
the confidence, which safety-net rule fired, and the words that drove the model —
so a clinician sees the reasoning rather than being asked to trust a colour.

A fuller walkthrough, with narration notes, is in
[ml/DEMO_SCRIPT.md](ml/DEMO_SCRIPT.md).

---

## Repository layout

```
├── src/                     # React SPA — patient chat, staff triage desk, admin panel
│   ├── components/          # Dashboard, StaffDashboard, AdminDashboard, ReportsTab
│   └── services/api.js      # fetch wrapper; attaches the JWT
├── server/                  # Express + MongoDB API
│   ├── services/            # triageEngine, mlClient, safetyNet, notifications
│   ├── controllers/ routes/ # auth, chats, triage, admin, notifications
│   ├── docs/ML_SERVICE_CONTRACT.md   # frozen contract between backend and ML
│   └── scripts/             # self-tests, mock ML service, contract checker
├── ml/                      # Flask ML microservice
│   ├── training/            # dataset builder + training with grouped evaluation
│   ├── models/              # metrics + VALIDATION.md (the model write-up)
│   ├── safety_net.py        # deterministic rules (English + Bangla)
│   └── evaluate.py, show_metrics.py, try_it.py
├── spec.md, plan.md         # specification and weekly plan
└── vercel.json              # SPA routing for deployment
```

---

## API

All routes are prefixed `/api`. Patient screening works without an account;
everything staff-facing requires a JWT with the right role.

| Route | Purpose |
|---|---|
| `POST /auth/register`, `POST /auth/login` | JWT auth, roles: patient / staff / admin |
| `POST /chats`, `POST /chats/:id/messages` | Patient screening — this is what triggers triage |
| `GET /triage/patients` | Staff queue, sorted by urgency; filters and pagination |
| `PUT /triage/patients/:id/status` | Contact, forward, or mark a false positive |
| `GET /notifications` | Staff alerts for new RED cases |
| `GET /admin/...` | Admin panel and reporting |
| `GET /health` | Service status, including whether the ML service is reachable |

The ML service contract is frozen and documented in
[server/docs/ML_SERVICE_CONTRACT.md](server/docs/ML_SERVICE_CONTRACT.md), so the
two sides can be developed and tested independently:

```bash
cd server && npm run check:ml    # verifies any ML service against the contract
```

---

## What happens when things break

| Failure | Behaviour |
|---|---|
| ML service down or slow | Requests time out, retry once, then a circuit breaker skips the call entirely. Submissions degrade to a keyword heuristic and are recorded as `fallback-heuristic` — **never silently GREEN**. |
| ML returns something unexpected | Validated against the contract; an unparseable label becomes YELLOW for review, not GREEN. |
| Model wrong about an emergency | The safety net escalates independently of the model. |
| Backend restarted | With the in-memory database, data resets and re-seeds. |

You can see the fail-safe yourself: stop the Flask service, send another message,
and note that dangerous phrases are still escalated to RED.

---

## Testing

```bash
cd ml && python -m pytest -q          # 254 tests
```

Includes a **parity test** that runs the same messages through both safety-net
implementations — the Python one and the JavaScript one that actually runs in
production — and fails if they disagree. They had silently drifted apart once;
this makes that impossible to repeat.

```bash
cd server
npm run selftest         # triage engine end to end
npm run selftest:queue   # queue ordering and filters
npm run check:ml         # ML service contract compliance
npm run mock:ml          # mock ML service, for testing without Python
```

---

## Model performance

```bash
cd ml && python show_metrics.py
```

| Measured on | Model alone | Deployed (model + safety net) |
|---|---|---|
| Hand-written messages, sealed before tuning | 0.821 | **0.875** accuracy, **0.818** RED recall |
| Held-out templates | 0.833 | 0.858 accuracy, 0.837 RED recall |
| *Naive random split* | *0.994* | *— shown only to expose the leakage* |

That last row matters. The training data is template-generated, so a random
train/test split scores the model on near-duplicates of sentences it has already
seen — which is how this project once reported ~100% accuracy. Splitting by
template instead drops it to 83%, and **that is the honest number**.

The full methodology, the improvements that followed, and the failures that
remain are documented in [ml/models/VALIDATION.md](ml/models/VALIDATION.md).

---

## Limitations

This is a course prototype, not a clinical device.

- **The dataset is synthetic.** No public dataset maps Bangla/English kidney
  symptom chat to urgency, so the corpus was self-constructed from clinically
  grounded templates. It is illustrative patient phrasing, not real patient data.
- **The safety net matches keywords**, so it can still miss an emergency
  described in unfamiliar words. Known examples are listed in VALIDATION.md §8.6.
- **Bangla coverage is thinner than English** — fewer templates and rules, and no
  transliterated "banglish", which real patients use.
- **It does not diagnose.** It ranks messages for human review. Every case is
  seen by a clinician; the system only decides what they see first.
