# S.O.S. — 6-Week Execution Plan

A week-by-week roadmap for building **S.O.S. (Symptom Optimized Screener)** as
specified in [spec.md](spec.md). Work runs in three parallel streams matching the
team's division of responsibility:

| Stream | Owner |
|---|---|
| **Frontend** | Mohd Salman Akther Khan Sabit |
| **Backend & Database** | Sk. Arif Bin Ekram |
| **Machine Learning / AI** | Mohammad Imtiaz Hassan |

Each week lists its goal, the spec sections it satisfies, per-stream deliverables,
and an exit criterion. The three streams are **modular by design** (spec.md §2.3):
each is an independently runnable module in its own directory, communicating only
over the API contracts frozen in spec.md §6.2 and §6.3.5. This lets each member
build and test their module individually and merge the pieces cleanly at the
integration weeks — wiring modules together, not redesigning them.

**Status legend:** ✅ completed · ⬜ scheduled

---

## Week 1 — Requirements, design & project foundation ✅

**Goal:** ground the project clinically and technically; establish the UI foundation.
**Satisfies:** spec §1 (goals/scope), §2 (architecture), §3 (severity tiers), §6.2 (data models).

**Deliverables:**
- Requirements analysis and full project proposal: problem statement, literature
  review (ML-assisted triage, NLP on patient-generated text, ML in nephrology),
  motivation, aims, and projected plan/timeline/cost.
- **Symptom→severity mapping** — illustrative message-to-tier labeling grounded in
  clinical references (basis for dataset construction).
- **Database schema design** — `User` and `Submission` document models, including
  the `mlLabel` / `ruleOverride` / `finalLabel` / `status` fields.
- **Safety-net design** — critical-phrase override concept and initial phrase set.
- UI wireframes; landing page with hospital cards; sign-up and login pages with
  password-strength validation and **Telegram OTP verification**.

**Exit:** proposal submitted; architecture, schema, and severity scheme fixed; a user can register (with OTP verification) and log in. ✅

---

## Week 2 — Patient chat prototype ✅

**Goal:** a working end-to-end patient experience on the UI layer.
**Satisfies:** spec §6.1 (patient portal), §4.2 NFR6 (responsive UI, theming).

**Deliverables:**
- ChatGPT-style **patient chat interface**: conversation sidebar with history and
  search, message bubbles, suggestion chips, auto-scroll and auto-resize input.
- Per-user chat **persistence layer** (browser-storage adapter that stands in for
  the REST API until integration — same message shape the API will serve).
- Dark/light theme with system preference support; settings modal; toast
  notification system.
- Deployable SPA configuration (Vercel rewrites).

**Exit:** full patient flow demonstrable in the browser — **sign-up → OTP verification → login → chat with persisted history** — with responsive UI and dark mode. ✅

---

## Week 3 — Backend foundation · Dataset v1 · API layer ⬜

**Goal:** stand up the server and the dataset — the two pillars everything else consumes.
**Satisfies:** spec §5 (directory structure), §6.2 (auth, models), §6.3.1–6.3.2 (dataset, preprocessing), §6.3.4 (safety net).

**Deliverables:**
- **Backend:** `server/` scaffold; Express app; MongoDB Atlas cluster; Mongoose
  `User` and `Submission` models per spec §6.2; JWT auth (`/api/auth/register`,
  `/api/auth/login`) with bcrypt hashing and role field.
- **ML:** `ml/` scaffold; **labeled dataset v1** (~600 patient-style messages,
  `text,label` CSV, balanced GREEN/YELLOW/RED, clinically grounded); text
  preprocessing pipeline; **safety-net phrase list v1** implemented in
  `safety_net.py` with unit tests.
- **Frontend:** `src/services/` API layer scaffold (fetch wrappers matching the
  endpoint contract); doctor dashboard wireframe.

**Exit:** register/login round-trips against Atlas via Postman; dataset v1 loads and preprocesses cleanly; safety-net tests pass on the Appendix-style examples.

---

## Week 4 — Submissions API · Model training · Doctor dashboard ⬜

**Goal:** the classifier exists as a service; the staff-facing UI exists; the API serves both.
**Satisfies:** spec §6.2 (submissions endpoints, roles), §6.3.2–6.3.5 (training, evaluation, Flask service), §6.1 (doctor dashboard).

**Deliverables:**
- **Backend:** submissions endpoints (`POST /api/submissions`,
  `GET /api/submissions` with severity/status/patient filters,
  `GET /api/submissions/mine`, `PATCH /api/submissions/:id/status`,
  `GET /api/patients/:id/history`); role-guard middleware (patient vs staff).
- **ML:** train and compare **TF-IDF + Logistic Regression vs Linear SVM**;
  evaluation report — accuracy, per-class precision/recall/F1, confusion matrix,
  with **RED recall as the headline metric**; serialize the winning pipeline;
  stand up **Flask `/predict` + `/health`** combining classifier and safety-net
  override per the spec §6.3.5 contract.
- **Frontend:** doctor dashboard build — priority queue with severity badges,
  patient info panel, case-status controls.

**Exit:** `curl` against `/predict` returns correct labels for GREEN/YELLOW/RED examples and a safety-net override case; submissions CRUD works in Postman with role enforcement; doctor dashboard renders a mock queue.

---

## Week 5 — Three-way integration · Dataset v2 ⬜

**Goal:** the three streams converge — one system, real data end to end.
**Satisfies:** spec §2.2 (full flow), §4.2 NFR2 (fail-safe), §6.3.1 (dataset v2).

**Deliverables:**
- **Backend ↔ ML:** Express calls Flask on every submission; stores
  `mlLabel` / `ruleOverride` / `finalLabel`; **YELLOW fail-safe** when the ML
  service is unreachable; database indexing on queue-sort fields; API testing.
- **Frontend ↔ Backend:** the storage adapter is swapped for the `src/services/`
  API layer; JWT session handling; severity labels rendered end-to-end; case
  status and search/filter wired to live data.
- **ML:** **dataset v2 expansion** driven by error analysis of misclassified
  messages; model retraining and tuning; targeted analysis of RED recall; refined
  safety-net phrase list.

**Exit:** a message typed in the patient chat appears on the doctor dashboard, correctly classified and correctly positioned in the priority queue; killing the ML service degrades to YELLOW-flagged submissions rather than failure.

---

## Week 6 — Validation, polish & demonstration ⬜

**Goal:** a tested, documented, deployed prototype and a confident demo.
**Satisfies:** spec §4.2 (NFRs), §8 (free-tier deployment), §11 (guarantees).

**Deliverables:**
- **System:** end-to-end testing; edge cases (ML service down, invalid input,
  concurrent submissions, empty queue states); deployment to free tiers
  (Vercel frontend, Render/Railway backend + ML service).
- **ML:** final model validation writeup (metrics tables, confusion matrix,
  safety-net trigger statistics); demo scenarios — one clear message per tier plus
  one safety-net override that the model alone would have missed.
- **Frontend:** final UI polish; documentation.
- Presentation and demonstration preparation.

**Exit:** live demo runs the four scenarios end to end on the deployed system; documentation and final presentation complete.

---

## Risk Management

| Risk | Mitigation |
|---|---|
| Self-constructed dataset quality/size | Iterative v1 → v2 expansion driven by error analysis; clinical grounding from published references; the deterministic safety net guarantees escalation of explicitly dangerous messages independent of model quality |
| Classifier error on urgent messages | Safety-net override (`finalLabel = RED` when triggered); RED recall prioritized over accuracy in model selection and tuning |
| Integration complexity in Weeks 5–6 | REST and `/predict` contracts frozen in spec.md from the start; each service testable standalone (Postman / curl) before wiring together |
| ML service unavailable at runtime | Backend fail-safe: submissions stored as YELLOW and flagged for review — never silently GREEN |
| Free-tier hosting limits | Lightweight model (no GPU), document DB on managed free tier, static frontend — the whole system is sized for free infrastructure by design |
