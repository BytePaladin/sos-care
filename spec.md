# S.O.S. (Symptom Optimized Screener) — Specification

**A Patient Symptom Triage and Prioritization System for Kidney Disease Care**

**Status:** v1 — full system scope
**Course:** CSE299 (Junior Design), Section 12 — North South University
**Team:** NextGen Trio
**Faculty:** Ms. Tanzilah Noor Shabnam

| Member | ID | Role |
|---|---|---|
| Mohd Salman Akther Khan Sabit | 2321132642 | Frontend development |
| Sk. Arif Bin Ekram | 2311695042 | Backend development |
| Mohammad Imtiaz Hassan | 2321196642 | Machine Learning / AI |

---

## 1. Overview

Patients living with kidney disease — kidney stones, UTIs escalating to the kidney (pyelonephritis), acute kidney injury (AKI), chronic kidney disease (CKD), and dialysis/transplant complications — require frequent contact with their care teams, but that contact is rarely ordered by clinical urgency. A message describing a dangerous change in condition sits in the same undifferentiated queue as an appointment reschedule request. Kidney symptoms are also highly **context-dependent**: mild leg swelling or reduced urine output can be harmless in a healthy person but an early warning of fluid overload or deteriorating filtration in a kidney patient.

**S.O.S. is a web-based triage-support system** that reads free-text symptom messages submitted by patients through a chat interface, automatically assigns each message a severity label — **GREEN (routine)**, **YELLOW (needs review)**, or **RED (urgent)** — using an NLP classifier reinforced by a deterministic rule-based safety net, and surfaces the most urgent cases at the top of a doctor/staff dashboard.

### 1.1 Goals

1. Allow kidney patients to describe symptoms in natural language through a chat interface.
2. Automatically classify each message into GREEN / YELLOW / RED using NLP and machine learning.
3. Present incoming cases to clinical staff in order of urgency rather than order of arrival.
4. Maintain a searchable per-patient submission history so staff can track symptom progression over time.
5. Construct a **clinically grounded kidney-symptom-to-urgency dataset** — no such dataset exists in public form; building it is a stated contribution of this project.

### 1.2 Non-goals

- S.O.S. is **not a diagnostic tool** — it never tells a patient which disease they have.
- It does **not recommend treatment** or provide medical advice.
- It does **not replace clinical judgment** — it is a queue-prioritization layer that sits *in front of* a human care team. This deliberately narrow scope is a design decision, not a limitation.

---

## 2. Architecture Overview

**Stack:** React (Vite) frontend · Node.js/Express backend · MongoDB Atlas · Python/Flask ML microservice (scikit-learn).

### 2.1 Components

| Component | Responsibility |
|---|---|
| **Patient Portal** (React) | Registration/login with OTP verification, chat-style symptom submission, personal submission history, profile management |
| **Doctor Dashboard** (React) | Priority queue sorted RED > YELLOW > GREEN, patient info + history panel, case-status tracking, search & filter |
| **REST API** (Express) | Receives messages, authenticates requests (JWT, role-based), coordinates the ML service, serves dashboard data |
| **Auth Layer** (JWT + bcrypt) | Distinguishes `patient` and `staff` roles; secures protected endpoints; passwords stored only as bcrypt hashes |
| **Database** (MongoDB Atlas) | Document store for users and submissions; free managed tier |
| **ML Classifier** (scikit-learn) | TF-IDF + Logistic Regression / Linear SVM three-class severity classifier trained on the constructed dataset |
| **Safety-Net Rule Engine** (plain Python) | Deterministic keyword layer that force-escalates explicitly dangerous messages to RED, independent of the model |
| **ML Service** (Flask) | Lightweight microservice exposing classifier + safety net as a single `/predict` endpoint called only by the backend |

### 2.2 High-level flow

```
Patient (chat UI)
   │  free-text symptom message
   ▼
React Frontend ───────► Express Backend (JWT auth, stores raw message)
                              │  message text
                              ▼
                    Flask ML Microservice
                     ├─ TF-IDF + classifier ──► mlLabel
                     └─ rule engine (keywords) ─► may force RED
                              │
                              ▼  { mlLabel, ruleOverride, finalLabel }
                        MongoDB Atlas
                              │
                              ▼
                Doctor Dashboard — queue sorted RED > YELLOW > GREEN,
                then by arrival time; case status tracked to resolution
```

### 2.3 Modularity & integration strategy

The system is deliberately split into **three independently developed, independently runnable modules** — the React frontend, the Express backend, and the Flask ML service — so each team member owns one module and works in isolation, then the pieces merge cleanly at integration time.

- **Decoupling by HTTP contract.** The modules never share code or memory; they communicate only over the REST and `/predict` contracts frozen in §6.2 and §6.3.5. As long as a module honors its contract, its internals can change freely without touching the others.
- **Each module runs standalone.** The frontend runs against a storage adapter / mock API, the backend runs and is exercised via Postman, and the ML service is exercised via `curl` — none requires the other two to be present during development.
- **Contract-first, so merge is wiring, not rewriting.** Because the interfaces are agreed up front, integration (Weeks 5–6) is a matter of pointing one module at another's real URL, not reconciling incompatible designs.
- **Independent version control.** One branch per member building on `main` (§9); each module lives in its own top-level directory (§5), so branches touch disjoint files and merge without conflicts.
- **Swappable internals.** The ML model can be retrained or replaced, the database can be re-indexed, and the UI can be restyled — each behind its stable contract — without coordinated changes elsewhere.

### 2.4 Hybrid severity labeling (core safety design)

The severity label is **never produced by the ML model alone**. Every message is processed along two parallel paths:

1. The **classifier** predicts a label from the overall content of the message.
2. The **rule engine** independently scans for a fixed set of critical phrases.

The override rule combines them: **`finalLabel = RED` if the rule engine triggered, otherwise the classifier's label.** This guarantees that an explicitly dangerous message is escalated even if the model misclassifies it — the direct answer to "what happens when the model is wrong on a life-threatening message."

---

## 3. Severity Tiers

| Tier | Meaning | Example patient phrasing |
|---|---|---|
| 🔴 **RED** | Urgent — immediate staff attention | "I haven't passed any urine since yesterday" · "I can't breathe properly" · "There's blood in my urine and it won't stop" |
| 🟡 **YELLOW** | Needs review — potentially significant | "My legs and ankles have been swelling more over the last two days" · "I've felt very tired and a bit nauseous since changing my medication" |
| 🟢 **GREEN** | Routine — normal response cycle | "Can I eat bananas on my current diet?" · "I need to reschedule my appointment next week" |

---

## 4. Requirements

### 4.1 Functional requirements

| # | Requirement |
|---|---|
| FR1 | Patients can register with name/phone/password; identity is verified via OTP before account activation |
| FR2 | Patients can log in and submit free-text symptom messages through a chat interface |
| FR3 | Every submission is automatically assigned GREEN / YELLOW / RED before staff see it |
| FR4 | Explicitly dangerous phrases force-escalate a submission to RED regardless of model output |
| FR5 | Staff see a queue sorted by severity (RED > YELLOW > GREEN), then by submission time |
| FR6 | Staff can open a patient's profile and full submission history |
| FR7 | Staff can move a case through statuses: `new → reviewed → in_progress → resolved` |
| FR8 | Staff can search/filter the queue by severity, patient, status, and date |
| FR9 | Patients can view their own submission history |
| FR10 | Patient and staff roles are enforced on every protected endpoint |

### 4.2 Non-functional requirements

| # | Requirement |
|---|---|
| NFR1 | **Safety-first classification:** RED recall is the primary model metric — missing an urgent case is the worst failure mode |
| NFR2 | **Fail-safe degradation:** if the ML service is unreachable, submissions are stored as YELLOW (never silently GREEN) and flagged for review |
| NFR3 | **Zero operating cost:** all services run on free tiers; no paid datasets or APIs |
| NFR4 | **No specialized hardware:** the model trains and serves on standard laptops, no GPU |
| NFR5 | **Security:** passwords bcrypt-hashed, JWT-protected endpoints, secrets in gitignored `.env` files |
| NFR6 | **Responsive UI** with light/dark themes, usable on desktop and mobile |

---

## 5. Directory Structure

The repository is organized as a monorepo with three top-level areas mapping to the three work streams. The React app occupies the repository root (established in Weeks 1–2); the backend and ML service are added alongside it:

```
sos-care/
├── src/                        # React frontend (Sabit)
│   ├── components/             #   LandingPage, LoginPage, SignUpPage,
│   │                           #   Dashboard (patient chat), SettingsModal, Toast,
│   │                           #   DoctorDashboard (priority queue — Week 4)
│   ├── context/                #   ThemeContext (dark/light)
│   ├── services/               #   API layer — fetch wrappers around the REST API
│   └── data/                   #   mock data (replaced by services/ at integration)
├── public/                     # logos, favicon, icons
├── server/                     # Node.js/Express backend (Arif)
│   └── src/
│       ├── config/             #   db connection, env loading
│       ├── models/             #   User.js, Submission.js (Mongoose)
│       ├── middleware/         #   auth (JWT verify), role guard
│       ├── routes/             #   auth.js, submissions.js, patients.js
│       ├── controllers/        #   request handlers
│       └── services/           #   mlClient.js (calls Flask /predict, YELLOW fail-safe)
├── ml/                         # Python ML microservice (Imtiaz)
│   ├── data/                   #   dataset CSVs (v1, v2)
│   ├── training/               #   preprocessing, train/evaluate scripts
│   ├── models/                 #   serialized vectorizer + classifier (joblib)
│   ├── safety_net.py           #   rule-based keyword override layer
│   ├── app.py                  #   Flask service (/predict, /health)
│   └── requirements.txt
├── spec.md                     # this document
├── plan.md                     # 6-week execution plan
└── vercel.json                 # SPA deployment config
```

---

## 6. Component Specifications

### 6.1 Frontend — React (Sabit)

**Foundation (Weeks 1–2):** React 19 + Vite + Tailwind CSS v4 SPA. Landing page with hospital cards; sign-up with password-strength validation and **Telegram-based OTP verification**; login; ChatGPT-style patient chat (sidebar with chat history and search, message bubbles, suggestion chips, auto-scroll); settings modal; dark/light theme; toast notifications; per-user persistence layer (browser-storage adapter standing in for the API until integration).

**Buildout (Weeks 3–6):**
- `src/services/` API layer so the storage adapter swaps for real endpoints without UI changes.
- **Doctor dashboard:** priority queue with severity badges, patient info panel, submission history, case-status controls, search/filter.
- Severity badge rendering on classified messages; role-aware views (patient vs staff); JWT session handling.

### 6.2 Backend — Node.js / Express + MongoDB (Arif)

REST API. All protected routes require a JWT; role checks distinguish `patient` and `staff`.

**Endpoint contract** (frozen here so all three streams build in parallel without blocking):

| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | — | Create account (bcrypt-hashed password), role `patient` |
| POST | `/api/auth/login` | — | Verify credentials → `{ token, user: { id, name, role } }` |
| POST | `/api/submissions` | patient | Store message, call ML service, persist labels |
| GET | `/api/submissions` | staff | Queue sorted by `finalLabel` then `createdAt`; filters: `severity`, `status`, `patientId` |
| GET | `/api/submissions/mine` | patient | Patient's own history |
| PATCH | `/api/submissions/:id/status` | staff | Update case status |
| GET | `/api/patients/:id/history` | staff | Patient profile + full submission history |

**Data models (MongoDB collections):**

```js
User {
    _id:       ObjectId,
    name:      String,
    phone:     String,        // unique
    password:  String,        // bcrypt hash
    role:      "patient" | "staff",
    createdAt: Date
}

Submission {
    _id:          ObjectId,
    patientId:    ObjectId,
    messageText:  String,
    mlLabel:      "GREEN" | "YELLOW" | "RED",   // classifier output
    ruleOverride: Boolean,                      // keyword override triggered?
    finalLabel:   "GREEN" | "YELLOW" | "RED",   // value used in queue
    status:       "new" | "reviewed" | "in_progress" | "resolved",
    createdAt:    Date
}
```

**Fail-safe:** if the Flask service is unreachable, the submission is stored with `finalLabel: "YELLOW"` and flagged for review — degraded service never silently files a message as routine.

### 6.3 Machine Learning / AI — Python + Flask (Imtiaz)

#### 6.3.1 Dataset (project contribution)

No public dataset maps patient-style kidney-symptom chat text to urgency levels, so the project constructs one:

- **Format:** CSV, `text,label`, label ∈ `GREEN | YELLOW | RED`.
- **Clinical grounding:** symptom→severity mapping derived from clinical references (National Kidney Foundation patient-education material on AKI/CKD warning signs); the proposal's illustrative mapping serves as seed rows.
- **Content:** patient-style free text across kidney conditions (stones, UTI/pyelonephritis, AKI, CKD, dialysis/transplant complications) plus routine dietary/administrative messages for GREEN. Includes colloquial phrasing, misspellings, and mixed-content messages to reflect real chat text.
- **Size:** ~600–1,000+ labeled messages, approximately balanced across classes; v1 built in Week 3, v2 expansion in Week 5 driven by error analysis.

#### 6.3.2 Model pipeline

- **Preprocessing:** lowercase, punctuation/whitespace normalization — negations preserved ("no urine" is signal, not noise).
- **Features:** TF-IDF (word 1–2 grams; character n-grams evaluated for robustness to misspellings).
- **Classifiers compared:** Logistic Regression and Linear SVM (scikit-learn). Deliberately lightweight — trains in seconds on a laptop CPU.
- **Serialization:** vectorizer + model persisted with `joblib`, loaded once at Flask startup.

#### 6.3.3 Evaluation protocol

- Stratified train/test split + k-fold cross-validation.
- Reported metrics: accuracy, per-class precision/recall/F1, confusion matrix.
- **RED recall is the safety-critical metric** — a RED message predicted GREEN/YELLOW is the worst failure mode; tuning and error analysis prioritize it over raw accuracy.

#### 6.3.4 Rule-based safety net

A deterministic phrase-matching layer (plain Python) that runs independently of the classifier on every message. Indicative critical-phrase set (refined against clinical references during dataset construction):

- "no urine" / "can't pass urine" / "haven't urinated"
- "can't breathe" / "difficulty breathing" / "short of breath"
- "chest pain"
- "uncontrolled bleeding" / "won't stop bleeding"
- "fainted" / "passed out"
- "severe confusion"

**Override rule:** `finalLabel = RED` if triggered, else `mlLabel`.

#### 6.3.5 Flask API contract

```
GET  /health
  → 200 { "status": "ok", "modelLoaded": true }

POST /predict
  body:     { "text": "I haven't passed urine since yesterday" }
  response: {
    "mlLabel":      "YELLOW",   // raw classifier prediction
    "ruleOverride": true,       // safety net triggered
    "finalLabel":   "RED"       // value the backend stores and queues
  }
```

The Express backend is the only caller of this service.

---

## 7. Tech Stack

| Component | Tool / Technology | Purpose |
|---|---|---|
| Frontend | React.js (Vite) + Tailwind CSS | Patient chat interface and staff dashboard; responsive UI |
| Backend | Node.js + Express.js | REST API that receives messages, coordinates services, serves the dashboard |
| Authentication | JSON Web Tokens (JWT) + bcrypt | Patient/staff roles; secured endpoints |
| Database | MongoDB Atlas (Mongoose) | Flexible document store for chat/symptom data; free managed tier |
| ML / NLP | Python + scikit-learn (TF-IDF + LogReg / SVM) | Three-class severity classifier trained on the constructed dataset |
| ML service | Flask | Microservice exposing the trained model as an API endpoint |
| Safety net | Rule-based keyword layer (plain Python) | Deterministic override force-escalating dangerous messages to RED |
| OTP verification | Telegram Bot API | Account verification during sign-up |
| Tooling | VS Code, Git/GitHub, npm, pip | Editing, version control, package management |
| Hardware | Standard laptops (no GPU) | Sufficient for a lightweight scikit-learn model |

---

## 8. Projected Cost

| Item | Cost |
|---|---|
| MongoDB Atlas (database) | Free tier — $0 |
| Hosting for demo (Render / Vercel / Railway) | Free tier — $0 |
| Datasets and APIs | $0 (self-constructed dataset; open-source libraries) |
| Hardware | $0 (existing laptops; no GPU required) |
| **Total** | **$0** |

---

## 9. Team Workflow

The workflow is built around the modularity principle in §2.3 — each member owns one module and works individually, then the modules merge over their frozen contracts.

- **One module per member, one directory per module.** Frontend → `src/`, backend → `server/`, ML service → `ml/` (§5). Because the modules live in disjoint directories, branches touch disjoint files and merge without conflicts.
- **Branching:** one branch per member (`imtiaz`, etc.) building on `main`; merged via review.
- **Contract-first parallel development:** the API contracts in §6.2 and §6.3.5 are frozen by this document, so the three modules develop and test **independently** — frontend against a mock/storage adapter, backend via Postman, ML service via `curl` — none blocking the others.
- **Secrets:** environment variables (Telegram bot token, MongoDB URI, JWT secret) kept in local gitignored `.env` files, with a committed `.env.example` documenting the required variables per module.
- **Integration:** because the interfaces are agreed up front, the integration phase (Weeks 5–6) is wiring modules to each other's real URLs — not redesigning them. All three members work jointly during integration, per the proposal's contribution plan.

---

## 10. Future Work

- Extension to other chronic-disease populations (diabetes, cardiac care) by substituting a condition-appropriate symptom dataset — the chat → classifier → safety net → dashboard architecture is disease-agnostic by design.
- Refinement of the critical-phrase list in consultation with clinical references.
- Larger dataset and stronger models as data grows (the Flask service isolates the model behind a stable contract, so upgrades don't touch the rest of the system).

---

## 11. Summary of Core Guarantees

1. **No diagnosis, ever** — the system prioritizes a queue; it never names a disease or recommends treatment.
2. **A dangerous phrase always reaches RED** — the deterministic safety net overrides the model; classifier error cannot suppress an explicitly critical message.
3. **Degraded ML never hides a patient** — if the ML service is down, submissions default to YELLOW and are flagged, never silently GREEN.
4. **Staff always see the most urgent first** — the queue is sorted RED > YELLOW > GREEN before order of arrival.
5. **Every submission is preserved** — full per-patient history for continuity of care.
6. **Roles are enforced** — patients never see other patients' data; staff endpoints require the staff role.
7. **Zero operating cost** — free tiers, open-source libraries, self-constructed data, no GPU.
