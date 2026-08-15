# S.O.S. Care — Symptom Optimized Screener

An ML-assisted patient triage prototype: a patient describes symptoms in a chat
interface, a hybrid classifier (TF-IDF model + deterministic safety net) assigns
a **GREEN / YELLOW / RED** severity, and the case appears on a clinical triage
dashboard sorted by urgency.

See [spec.md](spec.md) for the full specification and [plan.md](plan.md) for the
week-by-week plan.

| Stream | Owner |
|---|---|
| Frontend | Mohd Salman Akther Khan Sabit |
| Backend & Database | Sk. Arif Bin Ekram |
| Machine Learning / AI | Mohammad Imtiaz Hassan |

## Architecture

```
Vite + React SPA  ──/api──▶  Express + MongoDB  ──/predict──▶  Flask ML service
  (port 5173)                   (port 5000)                      (port 5001)
```

The frontend never talks to the ML service directly. Express owns the triage
decision: it calls the classifier, runs its own deterministic safety net, and
persists both the raw model label and the final label for audit.

## Running the full stack

Prerequisites: **Node.js 18+** and **Python 3.10+**.

One-time install:

```bash
npm install
cd server && npm install && cd ..
cd ml && pip install -r requirements.txt && cd ..
```

The ML model binary is gitignored (regenerable), so train it once after cloning:

```bash
cd ml && python training/train.py --data dataset_v2.csv && cd ..
```

Then start the three services in **three separate terminals**:

```bash
cd ml && python app.py
```

```bash
cd server && npm run dev
```

```bash
npm run dev
```

Open http://localhost:5173.

### Database

`server/.env` is created from [server/.env.example](server/.env.example). If
`MONGODB_URI` is left unset, the backend starts an **in-memory MongoDB** and
seeds demo data automatically — no local `mongod` or Atlas account needed. The
data resets on every restart. To use a real database instead, set `MONGODB_URI`
in `server/.env` and run `cd server && npm run seed` once.

### Demo accounts

Seeded by [server/seed.js](server/seed.js):

| Role | Phone | Password |
|---|---|---|
| Patient | `01700000000` | `password123` |
| Staff (Dr. Nusrat) | `01800000000` | `password123` |
| Staff (Dr. Tanvir) | `01900000000` | `password123` |

## Demonstrating it

[ml/DEMO_SCRIPT.md](ml/DEMO_SCRIPT.md) has a scripted walkthrough: one message
per severity tier, the safety-net override, and the ML-service-down fail-safe.

## Health check

```bash
curl http://localhost:5000/api/health
```

Reports whether the ML service is reachable and how many safety-net rules are
loaded. If it says `offline (fallback heuristic active)`, the Flask service isn't
running — the system still works, degrading to a keyword heuristic, and the
safety net still force-escalates critical messages.
