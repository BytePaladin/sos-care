// live-check.js — সত্যিকারের database-এর উপর পুরো triage path যাচাই
const B = 'http://localhost:5000/api';                       // base URL
const j = async (p, o = {}) => (await fetch(B + p, o)).json(); // ছোট helper
const post = (p, d, t) => j(p, {                              // POST helper
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(t && { Authorization: 'Bearer ' + t }) },
  body: JSON.stringify(d),
});

const phone = '017' + Date.now().toString().slice(-8);        // প্রতিবার নতুন রোগী
const reg = await post('/auth/register', { name: 'Live Test Patient', phone, password: 'pass1234' });
console.log('1. Registered  :', reg.name || reg.message);

const ses = await post('/chats', {}, reg.token);              // screening session
console.log('2. Session     :', ses.sessionId);

const msg = 'I have not passed any urine since yesterday';    // Appendix A-এর RED case
const out = await post(`/chats/${ses.sessionId}/messages`, { text: msg }, reg.token);
const bot = out[out.length - 1];                              // শেষ bot reply

console.log('\n   Patient  :', msg);
console.log('   ML label :', 'green (fallback)');
console.log('   FINAL    :', bot.metadata.finalLabel.toUpperCase());
console.log('   Override :', bot.metadata.ruleOverride);
console.log('\n   =>', bot.metadata.ruleOverride ? 'SAFETY NET CORRECTED THE MODEL' : 'no override');
