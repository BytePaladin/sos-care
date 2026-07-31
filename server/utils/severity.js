/**
 * severity.js
 * Green / Yellow / Red — these three tiers are kept uniform everywhere in the project.
 * Kept here in one place as constants + helpers (according to proposal Section 5).
 */

// Canonical (actual) names of the three severity labels — always lowercase in DB
export const SEVERITY = {
  GREEN: 'green', // routine — normal inquiries
  YELLOW: 'yellow', // needs review — observation required
  RED: 'red', // urgent — emergencies
};

// Numeric priority for queue sorting (higher number = shows first)
export const SEVERITY_PRIORITY = {
  red: 3, // Red comes first
  yellow: 2, // then Yellow
  green: 1, // finally Green
};

// staff review statuses used in dashboard (according to ER diagram)
export const REVIEW_STATUSES = ['pending', 'contacted', 'false_positive', 'needs_review'];

/**
 * Safely converts any external label ("RED", "Red ", "urgent")
 * to the canonical lowercase label.
 * Acts as a fail-safe by returning 'yellow' (not green) if something unknown is encountered —
 * because assuming an unknown issue is routine is riskier for the patient.
 */
export const normalizeSeverity = (value) => {
  if (typeof value !== 'string') return SEVERITY.YELLOW; // safe default if not string
  const clean = value.trim().toLowerCase(); // cleaning spacing + case

  if (clean === 'red' || clean === 'urgent' || clean === '2') return SEVERITY.RED; // all forms of Red
  if (clean === 'yellow' || clean === 'needs_review' || clean === '1') return SEVERITY.YELLOW; // all forms of Yellow
  if (clean === 'green' || clean === 'routine' || clean === '0') return SEVERITY.GREEN; // all forms of Green

  return SEVERITY.YELLOW; // unknown label = leaning towards the safe side
};

// Small helper to verify if a severity is valid
export const isValidSeverity = (value) =>
  Object.values(SEVERITY).includes(String(value).toLowerCase()); // true if matches one of the three

// Returns the higher severity between two labels (useful for safety-net overrides)
export const higherSeverity = (a, b) => {
  const first = normalizeSeverity(a); // normalize first label
  const second = normalizeSeverity(b); // normalize second label
  return SEVERITY_PRIORITY[first] >= SEVERITY_PRIORITY[second] ? first : second; // higher priority wins
};
