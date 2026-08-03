/**
 * triageController.js
 * Week 3 update:
 *  - Priority queue sorting (Red → Yellow → Green) added server-side.
 *  - severity / status / search / date filters added as query params.
 *  - Every staff action is now saved in StaffAction collection as audit.
 *  - response shape kept as array to prevent frontend breaking.
 */

import { PatientTriage } from '../models/PatientTriage.js'; // triage record model
import { ChatSession } from '../models/ChatSession.js'; // to fetch chat history
import { StaffAction } from '../models/StaffAction.js'; // audit trail model
import { asyncHandler } from '../utils/asyncHandler.js'; // try/catch wrapper
import { SEVERITY_PRIORITY, REVIEW_STATUSES, isValidSeverity } from '../utils/severity.js'; // severity helper

/**
 * Formats a triage document + its chat history into frontend's expected shape.
 * Previously this code was copied in two places — now moved to a helper.
 */
const formatPatient = (doc, session) => {
  const p = doc.toObject(); // convert mongoose document to plain object

  return {
    _id: p._id, // main id
    id: p._id.toString(), // frontend uses string id
    patientName: p.patientName, // patient's name
    name: p.patientName, // old frontend key
    patientPhone: p.patientPhone, // phone number
    phone: p.patientPhone, // old frontend key
    category: p.finalLabel || p.category, // final label is shown
    initialCategory: p.initialCategory || p.mlLabel || p.category || 'green', // original AI tier
    doctorOverride: p.doctorOverride || { isOverridden: false }, // doctor escalation/de-escalation metadata
    mlLabel: p.mlLabel, // what model said (new)
    ruleOverride: p.ruleOverride, // whether safety-net triggered (new)
    matchedKeywords: p.matchedKeywords || [], // which rule hit (new)
    modelSource: p.modelSource, // label source (new)
    aiAnalysis: p.aiAnalysis, // summary and tag
    reviewStatus: p.reviewStatus, // review status
    reviewComment: p.reviewComment, // staff's comment
    reviewedBy: p.reviewedBy ? p.reviewedBy.name : null, // who reviewed
    reviewedAt: p.reviewedAt, // when it was reviewed
    forwardedTo: p.forwardedTo ? p.forwardedTo._id.toString() : null, // who it was forwarded to
    forwardedToName: p.forwardedTo ? p.forwardedTo.name : null, // their name
    notes: p.notes || [], // clinical note timeline
    screenedAt: p.screenedAt, // screening time
    chatHistory: session ? session.messages : [], // full conversation
  };
};

/**
 * GET /api/triage/patients
 * Query params (all optional):
 *   ?severity=red|yellow|green   — specific tier
 *   ?status=pending|contacted|false_positive|needs_review
 *   ?search=<name or phone>
 *   ?since=<ISO date>            — records after this date
 *   ?limit=<number>              — max count (default 200)
 */
export const getPatients = asyncHandler(async (req, res) => {
  const { severity, status, search, since, limit } = req.query; // get query params
  const filter = {}; // MongoDB filter object will be built step by step

  // add to filter if severity is provided and valid
  if (severity && isValidSeverity(severity)) {
    filter.finalLabel = severity.toLowerCase(); // match using lowercase
  }

  // add to filter if review status is provided and valid
  if (status && REVIEW_STATUSES.includes(status)) {
    filter.reviewStatus = status; // direct match
  }

  // search by name or phone — regex escape to prevent injection
  if (search && search.trim()) {
    const safe = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // special char escape
    filter.$or = [
      { patientName: { $regex: safe, $options: 'i' } }, // search in names
      { patientPhone: { $regex: safe, $options: 'i' } }, // search in phones
    ];
  }

  // if records after a specific date are requested
  if (since) {
    const sinceDate = new Date(since); // convert string to Date
    if (!Number.isNaN(sinceDate.getTime())) {
      filter.screenedAt = { $gte: sinceDate }; // those after that time
    }
  }

  // how many to fetch at once — capped at max 500
  const maxDocs = Math.min(Number(limit) || 200, 500);

  const patients = await PatientTriage.find(filter) // apply filter
    .populate('reviewedBy', 'name staffRole') // reviewing staff's name
    .populate('forwardedTo', 'name staffRole') // forwarded staff's name
    .sort({ screenedAt: -1 }) // by time first
    .limit(maxDocs); // apply limit

  const patientIds = patients.map((p) => p._id); // their ids
  const chatSessions = await ChatSession.find({ triageId: { $in: patientIds } }); // all chats in one query

  // Build triageId → session Map for fast lookup (previously find() was called per patient)
  const sessionMap = new Map(); // key = triageId string
  chatSessions.forEach((cs) => sessionMap.set(cs.triageId.toString(), cs)); // fill Map

  const formatted = patients.map((p) => formatPatient(p, sessionMap.get(p._id.toString()))); // format

  // ── Priority queue sorting (Proposal: Red first) ──
  formatted.sort((a, b) => {
    // pending patients are always above reviewed patients
    const aPending = a.reviewStatus === 'pending' ? 1 : 0; // 1 if pending
    const bPending = b.reviewStatus === 'pending' ? 1 : 0; // 1 if pending
    if (aPending !== bPending) return bPending - aPending; // pending first

    // then by severity — Red → Yellow → Green
    const aRank = SEVERITY_PRIORITY[a.category] || 0; // priority of a
    const bRank = SEVERITY_PRIORITY[b.category] || 0; // priority of b
    if (aRank !== bRank) return bRank - aRank; // higher priority first

    // if all equal, newer screening first
    return new Date(b.screenedAt) - new Date(a.screenedAt); // by time
  });

  res.json(formatted); // return as array (frontend contract unchanged)
});

/**
 * PUT /api/triage/patients/:id/status
 * staff changes the patient's review status; every change is audited.
 */
export const updatePatientStatus = asyncHandler(async (req, res) => {
  const { id } = req.params; // triage record id
  const { reviewStatus, reviewComment, forwardedTo } = req.body; // what will change

  const patient = await PatientTriage.findById(id); // find record
  // 404 if not found
  if (!patient) {
    return res.status(404).json({ message: 'Patient triage record not found' });
  }

  // verify if provided reviewStatus is valid
  if (reviewStatus && !REVIEW_STATUSES.includes(reviewStatus)) {
    return res.status(400).json({ message: `Invalid reviewStatus. Allowed: ${REVIEW_STATUSES.join(', ')}` });
  }

  if (reviewStatus) patient.reviewStatus = reviewStatus; // update status
  if (reviewComment !== undefined) patient.reviewComment = reviewComment; // update comment
  if (forwardedTo !== undefined) patient.forwardedTo = forwardedTo || null; // update forward

  patient.reviewedBy = req.user._id; // who changed it
  patient.reviewedAt = new Date(); // when they changed it

  await patient.save(); // save

  // ── audit trail: this action is being written to StaffAction collection ──
  await StaffAction.create({
    submissionId: patient._id, // which record
    staffId: req.user._id, // which staff
    staffName: req.user.name, // save name
    actionType: forwardedTo ? 'ASSIGNED' : 'STATUS_UPDATE', // ASSIGNED if forwarded
    status: patient.reviewStatus, // status after action
    note: reviewComment || '', // comment
  });

  // fetching updated record again with populate
  const updated = await PatientTriage.findById(id)
    .populate('reviewedBy', 'name staffRole') // reviewing staff
    .populate('forwardedTo', 'name staffRole'); // forwarded staff

  const session = await ChatSession.findOne({ triageId: id }); // chat history

  res.json(formatPatient(updated, session)); // return formatted with same helper
});

/**
 * POST /api/triage/patients/:id/notes
 * staff adds a clinical note; note also goes to audit trail.
 */
export const addPatientNote = asyncHandler(async (req, res) => {
  const { id } = req.params; // triage record id
  const { text } = req.body; // note text

  const patient = await PatientTriage.findById(id); // find record
  // 404 if not found
  if (!patient) {
    return res.status(404).json({ message: 'Patient triage record not found' });
  }

  // note author's name — added in parenthesis if staffRole exists
  const authorLabel = req.user.name + (req.user.staffRole ? ` (${req.user.staffRole})` : '');

  patient.notes.push({
    author: authorLabel, // author name
    authorId: req.user._id, // author id
    text: String(text).trim(), // clean text
    timestamp: new Date(), // time
  });

  await patient.save(); // save

  // audit trail info for added note
  await StaffAction.create({
    submissionId: patient._id, // which record
    staffId: req.user._id, // which staff
    staffName: req.user.name, // name
    actionType: 'NOTE_ADDED', // action type
    status: patient.reviewStatus, // current status
    note: String(text).trim().slice(0, 200), // truncated part
  });

  res.status(201).json(patient.notes); // return full note list (old contract)
});

/**
 * GET /api/triage/stats
 * For the upper counters on the Doctor dashboard — calculated in one query.
 */
export const getTriageStats = asyncHandler(async (req, res) => {
  // Label + status based counting using MongoDB aggregation
  const rows = await PatientTriage.aggregate([
    {
      $group: {
        _id: { label: '$finalLabel', status: '$reviewStatus' }, // group by two fields
        count: { $sum: 1 }, // how many in each group
      },
    },
  ]);

  // Create a structure with all zeros initially
  const stats = {
    total: 0, // total records
    active: { red: 0, yellow: 0, green: 0 }, // pending status
    reviewed: { red: 0, yellow: 0, green: 0 }, // reviewed status
  };

  // Iterate through aggregation results and assign counts
  rows.forEach((row) => {
    const label = row._id.label || 'green'; // green if no label
    const bucket = row._id.status === 'pending' ? 'active' : 'reviewed'; // which bucket to go in
    if (stats[bucket][label] !== undefined) stats[bucket][label] += row.count; // add count
    stats.total += row.count; // increase total
  });

  res.json(stats); // return counts
});

/**
 * GET /api/triage/patients/:id/actions
 * Returns all staff actions (audit trail) taken on a patient.
 */
export const getPatientActions = asyncHandler(async (req, res) => {
  const actions = await StaffAction.find({ submissionId: req.params.id }) // actions for that record
    .sort({ createdAt: -1 }) // newer ones first
    .limit(100); // max 100

  res.json(actions); // return list
});

/**
 * PUT /api/triage/patients/:id/severity
 * Staff escalates or de-escalates a patient's triage severity tier.
 */
export const updatePatientSeverity = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { category, reason } = req.body;

  const validTiers = ['red', 'yellow', 'green'];
  const newTier = category ? category.toLowerCase().trim() : '';
  if (!validTiers.includes(newTier)) {
    return res.status(400).json({ message: 'Invalid triage category. Must be red, yellow, or green' });
  }

  const patient = await PatientTriage.findById(id);
  if (!patient) {
    return res.status(404).json({ message: 'Patient triage record not found' });
  }

  const previousCategory = patient.finalLabel || patient.category || 'green';
  const initialCategory = patient.initialCategory || patient.mlLabel || previousCategory;

  // Determine transition type (Escalation vs De-escalation)
  const severityRank = { red: 3, yellow: 2, green: 1 };
  const prevRank = severityRank[previousCategory] || 1;
  const newRank = severityRank[newTier] || 1;
  const transitionType = newRank > prevRank ? 'ESCALATED' : newRank < prevRank ? 'DE-ESCALATED' : 'RE-CONFIRMED';

  // Apply updates
  patient.initialCategory = initialCategory;
  patient.category = newTier;
  patient.finalLabel = newTier;
  patient.doctorOverride = {
    isOverridden: true,
    overriddenBy: req.user._id,
    overriddenByName: req.user.name,
    overriddenAt: new Date(),
    previousCategory,
    reason: (reason || '').trim(),
  };

  await patient.save();

  // Audit trail entry
  const noteMessage = `[${transitionType}] ${req.user.name} changed severity from ${previousCategory.toUpperCase()} to ${newTier.toUpperCase()}${reason ? `: "${reason}"` : ''}`;
  await StaffAction.create({
    submissionId: patient._id,
    staffId: req.user._id,
    staffName: req.user.name,
    actionType: 'SEVERITY_OVERRIDE',
    status: patient.reviewStatus,
    note: noteMessage,
  });

  const updated = await PatientTriage.findById(id)
    .populate('reviewedBy', 'name staffRole')
    .populate('forwardedTo', 'name staffRole');

  const session = await ChatSession.findOne({ triageId: id });
  res.json(formatPatient(updated, session));
});

