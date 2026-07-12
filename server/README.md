# S.O.S. — Backend (API · Authentication · Database)

Backend service for **S.O.S. (Symptom Optimized Screener)** — a patient symptom triage and prioritization system for kidney disease care.

**Course:** CSE299 (Junior Design), Section 12 — North South University
**Module owner:** Sk. Arif Bin Ekram (2311695042)
**Status:** Milestone 1 of 4 — *Database schema + Authentication* (≈25% of backend scope)

---

## What is implemented (Milestone 1)

| Layer | Status | Files |
|---|---|---|
| Express app + security middleware | ✅ Done | `src/app.js` |
| MongoDB Atlas connection (retry + graceful shutdown) | ✅ Done | `src/config/db.js` |
| All 7 ER-diagram collections + OTP store | ✅ Done | `src/models/*` |
| JWT authentication (patient + staff) | ✅ Done | `src/controllers/authController.js` |
| OTP verification (server-side) | ✅ Done | `src/models/OtpToken.js` |
| Role-based access control | ✅ Done | `src/middleware/auth.js` |
| Centralized error handling | ✅ Done | `src/middleware/errorHandler.js` |
| Rate limiting (brute-force guard) | ✅ Done | `src/middleware/rateLimiter.js` |
| Symptom submission endpoints | ⬜ Milestone 2 | — |
| Flask ML service integration | ⬜ Milestone 3 | — |
| Doctor dashboard queue endpoints | ⬜ Milestone 3 | — |

---

## Quick start

```bash
cd server
npm install

cp .env.example .env      # then fill in MONGO_URI and JWT_SECRET

npm run seed              # inserts GREEN / YELLOW / RED severity levels
npm run seed:staff        # inserts demo doctor / nurse / admin accounts
npm run dev               # starts on http://localhost:5000
```

Generate a JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Run the offline verification suite (32 checks, no database required):

```bash
npm run verify
```

---

## API contract (Milestone 1)

Base URL: `http://localhost:5000/api`

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| `GET` | `/health` | — | Liveness probe |
| `POST` | `/auth/register` | — | Create patient account, issue OTP |
| `POST` | `/auth/verify-otp` | — | Verify OTP, activate account, return JWT |
| `POST` | `/auth/resend-otp` | — | Re-issue OTP |
| `POST` | `/auth/login` | — | Patient login (phone + password) → JWT |
| `POST` | `/auth/staff/login` | — | Doctor / Nurse / Admin login (email + password) → JWT |
| `GET` | `/auth/me` | Bearer | Current user profile |

### Success shape

```json
{ "success": true, "message": "...", "data": { } }
```

### Error shape

```json
{ "success": false, "message": "...", "errors": ["field: reason"] }
```

---

## Design decisions

**1. Phone number is the login identifier, not email.**
The ER diagram marked `email` as UNIQUE, but `LoginPage.jsx` and `SignUpPage.jsx` authenticate with a phone number. The database now treats `phoneNumber` as the unique login key and `email` as an optional sparse-unique field. The frontend contract wins over the diagram.

**2. OTP generation moved from the browser to the server.**
The original `SignUpPage.jsx` called the Telegram Bot API directly using `VITE_TELEGRAM_BOT_TOKEN`. Anything prefixed `VITE_` is inlined into the browser bundle and is publicly readable. OTPs are now generated with `crypto.randomInt()`, stored as a bcrypt hash with a TTL index, and never leave the server.

**3. `mlLabel`, `ruleOverride` and `finalLabel` are three separate columns.**
Collapsing them into one field would make it impossible to later measure how often the safety net caught a classifier error — which is the project's headline safety claim.

**4. `finalLabel` defaults to `YELLOW`, not `GREEN`.**
If the Flask ML service is unreachable, the message must still reach a human. Defaulting to `GREEN` would silently bury it.

**5. `Patient` and `Staff` are separate collections.**
Different login identifiers, different lifecycles, different permissions. One `users` collection with a nullable `role` would leak clinical staff into patient queries.

---

## Project structure

```
server/
├── src/
│   ├── config/       env validation, MongoDB connection
│   ├── models/       8 Mongoose schemas
│   ├── middleware/   auth (protect/authorize), errors, validation, rate limits
│   ├── controllers/  authController
│   ├── routes/       authRoutes + router index
│   ├── utils/        ApiError, asyncHandler, generateToken
│   ├── seed/         severity levels, demo staff
│   ├── app.js        Express app (no listen)
│   └── server.js     entry point (listen + graceful shutdown)
├── verify.mjs        32-check offline verification suite
├── .env.example
└── package.json
```

---

## Cost

| Item | Cost |
|---|---|
| MongoDB Atlas M0 | $0 (free tier) |
| Render / Railway (demo hosting) | $0 (free tier) |
| Dependencies | $0 (all open source) |
| **Total** | **$0** |
