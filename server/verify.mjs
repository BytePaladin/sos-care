process.env.MONGO_URI = 'mongodb://placeholder/sos_care';
process.env.JWT_SECRET = 'x'.repeat(48);
process.env.NODE_ENV = 'development';

const ok = (c, l, x='') => console.log(`  ${c ? '\x1b[32m✔\x1b[0m' : '\x1b[31m✘ FAIL\x1b[0m'}  ${l}${x ? '  → ' + x : ''}`);
let pass = 0, total = 0;
const t = (c, l, x='') => { total++; if (c) pass++; ok(c, l, x); };

const { default: app } = await import('./src/app.js');
const server = app.listen(5099);
const B = 'http://localhost:5099/api';
const call = async (m, p, body, token) => {
  const r = await fetch(B + p, { method: m,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, json: await r.json() };
};

console.log('\n\x1b[1m═══ 1. EXPRESS APP + ERROR HANDLING ═══\x1b[0m');
let r = await call('GET', '/health');
t(r.status === 200 && r.json.success, 'GET  /api/health            → 200', r.json.message);
r = await call('GET', '/does-not-exist');
t(r.status === 404 && r.json.success === false, 'GET  /api/does-not-exist    → 404 clean JSON');
t(typeof r.json.message === 'string', 'Error shape: { success:false, message } consistent');

console.log('\n\x1b[1m═══ 2. VALIDATION LAYER (runs before DB) ═══\x1b[0m');
r = await call('POST', '/auth/register', { fullName:'Rahim', phoneNumber:'01712345678', password:'weak' });
t(r.status === 400, 'register: password "weak"   → 400', r.json.errors?.[0]);
r = await call('POST', '/auth/register', { fullName:'Rahim', phoneNumber:'01712345678', password:'nouppercase@1' });
t(r.status === 400 && r.json.errors.some(e=>e.includes('uppercase')), 'register: no uppercase      → 400');
r = await call('POST', '/auth/register', { fullName:'Rahim', phoneNumber:'01712345678', password:'NoSpecial123' });
t(r.status === 400 && r.json.errors.some(e=>e.includes('special')), 'register: no special char   → 400');
r = await call('POST', '/auth/register', { fullName:'Rahim', phoneNumber:'12345', password:'Strong@123' });
t(r.status === 400 && r.json.errors.some(e=>e.includes('phone')), 'register: phone "12345"     → 400 (BD format)');
r = await call('POST', '/auth/register', { fullName:'', phoneNumber:'01712345678', password:'Strong@123' });
t(r.status === 400, 'register: empty fullName    → 400');
r = await call('POST', '/auth/verify-otp', { phoneNumber:'01712345678', otp:'12' });
t(r.status === 400 && r.json.errors.some(e=>e.includes('6 digits')), 'verify-otp: 2-digit OTP     → 400');
r = await call('POST', '/auth/verify-otp', { phoneNumber:'01712345678', otp:'abcdef' });
t(r.status === 400, 'verify-otp: non-numeric OTP → 400');
r = await call('POST', '/auth/staff/login', { email:'not-an-email', password:'x' });
t(r.status === 400, 'staff/login: bad email      → 400');

console.log('\n\x1b[1m═══ 3. AUTH MIDDLEWARE (protect) ═══\x1b[0m');
r = await call('GET', '/auth/me');
t(r.status === 401 && r.json.message.includes('no token'), 'GET /auth/me  no token      → 401');
r = await call('GET', '/auth/me', null, 'garbage.token.here');
t(r.status === 401 && r.json.message.includes('invalid'), 'GET /auth/me  garbage token → 401');

console.log('\n\x1b[1m═══ 4. JWT SIGN / VERIFY / TAMPER ═══\x1b[0m');
const { generateToken, verifyToken } = await import('./src/utils/generateToken.js');
const tok = generateToken('64f1a2b3c4d5e6f7a8b9c0d1', 'DOCTOR');
t(tok.split('.').length === 3, 'JWT structure: header.payload.signature');
const dec = verifyToken(tok);
t(dec.id === '64f1a2b3c4d5e6f7a8b9c0d1' && dec.role === 'DOCTOR', 'JWT roundtrip: id + role preserved');
t(dec.exp > dec.iat, 'JWT has expiry (exp > iat)');
let tampered = false;
try { verifyToken(tok.slice(0,-3) + 'xyz'); } catch { tampered = true; }
t(tampered, 'JWT tampered signature      → verify throws ✔');
const jwt = (await import('jsonwebtoken')).default;
let wrongKey = false;
try { jwt.verify(tok, 'a-different-secret-key-entirely-here'); } catch { wrongKey = true; }
t(wrongKey, 'JWT wrong secret            → verify throws ✔');

console.log('\n\x1b[1m═══ 5. BCRYPT PASSWORD HASHING ═══\x1b[0m');
const bcrypt = (await import('bcryptjs')).default;
const hash = await bcrypt.hash('Strong@123', await bcrypt.genSalt(10));
t(hash.startsWith('$2') && hash.length === 60, 'bcrypt hash format ($2b, 60 chars)', hash.slice(0,25)+'…');
t(hash !== 'Strong@123', 'Plain password NEVER stored');
t(await bcrypt.compare('Strong@123', hash) === true,  'compare correct password    → true');
t(await bcrypt.compare('Wrong@123',  hash) === false, 'compare wrong password      → false');
const hash2 = await bcrypt.hash('Strong@123', await bcrypt.genSalt(10));
t(hash !== hash2, 'Same password → different hash (salt works)');

console.log('\n\x1b[1m═══ 6. MONGOOSE SCHEMA VALIDATION (offline) ═══\x1b[0m');
const { default: Patient } = await import('./src/models/Patient.js');
const { default: Submission } = await import('./src/models/Submission.js');
const { default: Staff } = await import('./src/models/Staff.js');

let e = new Patient({ fullName:'R', phoneNumber:'99999', passwordHash:'x' }).validateSync();
t(!!e?.errors.phoneNumber && !!e?.errors.fullName, 'Patient: bad phone + short name  → rejected');
e = new Patient({ fullName:'Rahim Uddin', phoneNumber:'01712345678', passwordHash:'x' }).validateSync();
t(!e, 'Patient: valid doc               → accepted');
e = new Submission({ patientId:'64f1a2b3c4d5e6f7a8b9c0d1', messageText:'legs swelling', finalLabel:'PURPLE' }).validateSync();
t(!!e?.errors.finalLabel, 'Submission: finalLabel "PURPLE"  → rejected (enum)');
const sub = new Submission({ patientId:'64f1a2b3c4d5e6f7a8b9c0d1', messageText:'I cannot pass urine', mlLabel:'YELLOW', ruleOverride:true, finalLabel:'RED' });
t(!sub.validateSync() && sub.isUrgent === true && sub.status === 'NEW', 'Submission: safety-net shape OK  → isUrgent virtual = true');
t(new Submission({ patientId:'64f1a2b3c4d5e6f7a8b9c0d1', messageText:'hi', finalLabel:'GREEN' }).validateSync()?.errors.messageText, 'Submission: 2-char message       → rejected (minlength)');
const s2 = new Submission({ patientId:'64f1a2b3c4d5e6f7a8b9c0d1', messageText:'diet question', finalLabel:'GREEN' });
t(s2.ruleOverride === false && s2.mlLabel === null, 'Submission: defaults correct     → ruleOverride=false');
e = new Staff({ fullName:'Dr X', email:'d@x.com', passwordHash:'x', role:'JANITOR' }).validateSync();
t(!!e?.errors.role, 'Staff: role "JANITOR"            → rejected (enum)');
t(!new Staff({ fullName:'Dr X', email:'d@x.com', passwordHash:'x', role:'DOCTOR' }).validateSync(), 'Staff: role "DOCTOR"             → accepted');
const p = new Patient({ fullName:'Rahim', phoneNumber:'01712345678', passwordHash:'secret' });
t(JSON.parse(JSON.stringify(p)).passwordHash === undefined, 'toJSON strips passwordHash       → no leak');

console.log(`\n\x1b[1m════════════════════════════════════════\x1b[0m`);
console.log(`\x1b[1m  ${pass}/${total} checks passed\x1b[0m`);
console.log(`\x1b[1m════════════════════════════════════════\x1b[0m\n`);
server.close(); process.exit(pass === total ? 0 : 1);
