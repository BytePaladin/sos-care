/**
 * queue-selftest.js
 * --------------------------------------------------------------------------
 * Week 5 self-test — runs without a database, like the Week 3 triage test.
 *
 *   npm run selftest:queue
 *
 * Covers the three things added in Week 5 that are pure logic and therefore
 * checkable offline: pagination arithmetic, the priority ordering ranks, and
 * the rate limiter's window behaviour.
 *
 * The most important case here is the last one in section 2. It demonstrates
 * the defect the Week 5 ordering change fixes: under the previous approach a
 * limit was applied before the priority sort, so once the collection grew past
 * that limit an older pending RED patient could drop out of the result set
 * entirely and never appear on the dashboard.
 * --------------------------------------------------------------------------
 */

import { parsePagination, buildPageMeta } from '../utils/pagination.js';
import { SEVERITY_PRIORITY } from '../utils/severity.js';
import { rateLimit, _resetRateLimitState } from '../middleware/rateLimit.js';

let passed = 0;
let failed = 0;

const check = (name, condition, detail = '') => {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail ? `  → ${detail}` : ''}`);
  }
};

console.log('\n=== S.O.S. Queue & Safety Self-Test (Week 5) ===\n');

// ── 1. Pagination arithmetic ──────────────────────────────────────────────
console.log('1. Pagination');

const noPage = parsePagination({});
check('omitting ?page keeps the legacy array response', noPage.wantsPagination === false);

const p3 = parsePagination({ page: '3', limit: '10' });
check('page 3 at 10 per page skips 20 records', p3.skip === 20, `skip=${p3.skip}`);

const clamped = parsePagination({ page: '-4', limit: '5000' });
check('a negative page falls back to page 1', clamped.page === 1, `page=${clamped.page}`);
check('limit is capped so one call cannot pull everything', clamped.limit === 100, `limit=${clamped.limit}`);

const meta = buildPageMeta(53, { page: 2, limit: 25 });
check('53 records at 25 per page is 3 pages', meta.totalPages === 3, `totalPages=${meta.totalPages}`);
check('page 2 of 3 reports both neighbours', meta.hasNextPage && meta.hasPrevPage);

const empty = buildPageMeta(0, { page: 1, limit: 25 });
check('an empty queue reports 0 pages, not 1', empty.totalPages === 0, `totalPages=${empty.totalPages}`);

// ── 2. Priority ordering ──────────────────────────────────────────────────
console.log('\n2. Priority ordering (pending first, then Red → Yellow → Green)');

// Mirrors the ranks computed by the $addFields stage in triageController
const rank = (doc) => ({
  pending: doc.reviewStatus === 'pending' ? 1 : 0,
  severity: SEVERITY_PRIORITY[doc.finalLabel ?? doc.category] ?? 1,
  time: new Date(doc.screenedAt).getTime(),
});

const byPriority = (a, b) => {
  const ra = rank(a);
  const rb = rank(b);
  return rb.pending - ra.pending || rb.severity - ra.severity || rb.time - ra.time;
};

const day = (n) => new Date(2026, 0, n).toISOString();

const queue = [
  { name: 'Reviewed RED (recent)', reviewStatus: 'contacted', finalLabel: 'red', screenedAt: day(9) },
  { name: 'Pending GREEN (recent)', reviewStatus: 'pending', finalLabel: 'green', screenedAt: day(9) },
  { name: 'Pending RED (older)', reviewStatus: 'pending', finalLabel: 'red', screenedAt: day(2) },
  { name: 'Pending YELLOW', reviewStatus: 'pending', finalLabel: 'yellow', screenedAt: day(5) },
];

const ordered = [...queue].sort(byPriority).map((q) => q.name);
console.log(`       order: ${ordered.join('  →  ')}`);

check('an untouched urgent case leads the queue', ordered[0] === 'Pending RED (older)', ordered[0]);
check('Yellow sits above Green within pending',
  ordered.indexOf('Pending YELLOW') < ordered.indexOf('Pending GREEN (recent)'));
check('a handled Red drops below every pending case',
  ordered.indexOf('Reviewed RED (recent)') === ordered.length - 1, ordered[ordered.length - 1]);

// The defect fixed in Week 5: limiting before sorting hides urgent cases.
const filler = Array.from({ length: 205 }, (_, i) => ({
  name: `Routine ${i}`,
  reviewStatus: 'contacted',
  finalLabel: 'green',
  screenedAt: day(10 + (i % 20)),
}));
const withOldUrgent = [...filler, { name: 'URGENT (oldest)', reviewStatus: 'pending', finalLabel: 'red', screenedAt: day(1) }];

const previousApproach = [...withOldUrgent]
  .sort((a, b) => new Date(b.screenedAt) - new Date(a.screenedAt)) // DB sorted by time
  .slice(0, 200) // ...and limited
  .sort(byPriority); // ...only then prioritised

const currentApproach = [...withOldUrgent].sort(byPriority).slice(0, 200); // sort, then limit

check('previous approach lost the oldest urgent case',
  !previousApproach.some((r) => r.name === 'URGENT (oldest)'));
check('current approach places it at the top',
  currentApproach[0].name === 'URGENT (oldest)', currentApproach[0].name);

// ── 3. Rate limiter ───────────────────────────────────────────────────────
console.log('\n3. Login rate limiting');

_resetRateLimitState();

const limiter = rateLimit({ name: 'selftest', windowMs: 60000, max: 3 });

const attempt = (ip) =>
  new Promise((resolve) => {
    const res = {
      statusCode: 0,
      set() { return res; },
      status(code) { res.statusCode = code; return res; },
      json() { resolve({ allowed: false, status: res.statusCode }); return res; },
    };
    limiter({ headers: {}, ip, socket: {} }, res, () => resolve({ allowed: true, status: 200 }));
  });

const first = await attempt('203.0.113.10');
check('the first attempt is allowed through', first.allowed === true);

await attempt('203.0.113.10');
await attempt('203.0.113.10');
const fourth = await attempt('203.0.113.10');
check('the fourth attempt in the window is refused', fourth.allowed === false && fourth.status === 429, `status=${fourth.status}`);

const different = await attempt('198.51.100.20');
check('a different address is not affected', different.allowed === true);

// ── Summary ───────────────────────────────────────────────────────────────
console.log(`\nResult: ${passed} passed, ${failed} failed.\n`);
process.exit(failed > 0 ? 1 : 0);
