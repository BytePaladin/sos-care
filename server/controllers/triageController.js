/**
 * triageController.js
 * Week 3 update:
 *  - Priority queue sorting (Red → Yellow → Green) server-side এ যোগ হয়েছে.
 *  - severity / status / search / date filter query param হিসেবে যোগ হয়েছে.
 *  - প্রতিটি staff action এখন StaffAction collection-এ audit হিসেবে জমা হয়.
 *  - response shape আগের মতোই array রাখা হয়েছে যাতে frontend না ভাঙে.
 */

import { PatientTriage } from '../models/PatientTriage.js'; // triage record model
import { ChatSession } from '../models/ChatSession.js'; // chat history আনতে
import { StaffAction } from '../models/StaffAction.js'; // audit trail model
import { asyncHandler } from '../utils/asyncHandler.js'; // try/catch wrapper
import { SEVERITY_PRIORITY, REVIEW_STATUSES, isValidSeverity } from '../utils/severity.js'; // severity helper

/**
 * একটি triage document + তার chat history কে frontend-এর প্রত্যাশিত আকারে সাজায়.
 * আগে এই কোড দুই জায়গায় copy করা ছিল — এখন একটি helper-এ আনা হয়েছে.
 */
const formatPatient = (doc, session) => {
  const p = doc.toObject(); // mongoose document কে plain object করা

  return {
    _id: p._id, // মূল id
    id: p._id.toString(), // frontend string id ব্যবহার করে
    patientName: p.patientName, // রোগীর নাম
    name: p.patientName, // পুরনো frontend key
    patientPhone: p.patientPhone, // ফোন নম্বর
    phone: p.patientPhone, // পুরনো frontend key
    category: p.finalLabel || p.category, // চূড়ান্ত label-ই দেখানো হয়
    mlLabel: p.mlLabel, // model কী বলেছিল (নতুন)
    ruleOverride: p.ruleOverride, // safety-net চালু হয়েছিল কিনা (নতুন)
    matchedKeywords: p.matchedKeywords || [], // কোন rule hit করেছিল (নতুন)
    modelSource: p.modelSource, // label-এর উৎস (নতুন)
    aiAnalysis: p.aiAnalysis, // সারাংশ ও tag
    reviewStatus: p.reviewStatus, // review অবস্থা
    reviewComment: p.reviewComment, // staff-এর মন্তব্য
    reviewedBy: p.reviewedBy ? p.reviewedBy.name : null, // কে review করেছে
    reviewedAt: p.reviewedAt, // কখন review হয়েছে
    forwardedTo: p.forwardedTo ? p.forwardedTo._id.toString() : null, // কাকে forward করা হয়েছে
    forwardedToName: p.forwardedTo ? p.forwardedTo.name : null, // তার নাম
    notes: p.notes || [], // clinical note timeline
    screenedAt: p.screenedAt, // screening সময়
    chatHistory: session ? session.messages : [], // পুরো কথোপকথন
  };
};

/**
 * GET /api/triage/patients
 * Query params (সবগুলোই ঐচ্ছিক):
 *   ?severity=red|yellow|green   — নির্দিষ্ট tier
 *   ?status=pending|contacted|false_positive|needs_review
 *   ?search=<নাম বা ফোন>
 *   ?since=<ISO date>            — এই তারিখের পরের record
 *   ?limit=<সংখ্যা>              — সর্বোচ্চ কতগুলো (default 200)
 */
export const getPatients = asyncHandler(async (req, res) => {
  const { severity, status, search, since, limit } = req.query; // query param গুলো নেওয়া
  const filter = {}; // MongoDB filter object তৈরি হবে ধাপে ধাপে

  // severity দেওয়া থাকলে এবং বৈধ হলে filter-এ যোগ
  if (severity && isValidSeverity(severity)) {
    filter.finalLabel = severity.toLowerCase(); // lowercase করে মেলানো
  }

  // review status দেওয়া থাকলে এবং বৈধ হলে filter-এ যোগ
  if (status && REVIEW_STATUSES.includes(status)) {
    filter.reviewStatus = status; // সরাসরি মেলানো
  }

  // নাম বা ফোন দিয়ে খোঁজা — regex escape করে injection ঠেকানো হচ্ছে
  if (search && search.trim()) {
    const safe = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // special char escape
    filter.$or = [
      { patientName: { $regex: safe, $options: 'i' } }, // নামের মধ্যে খোঁজা
      { patientPhone: { $regex: safe, $options: 'i' } }, // ফোনের মধ্যে খোঁজা
    ];
  }

  // নির্দিষ্ট তারিখের পরের record চাইলে
  if (since) {
    const sinceDate = new Date(since); // string কে Date-এ রূপান্তর
    if (!Number.isNaN(sinceDate.getTime())) {
      filter.screenedAt = { $gte: sinceDate }; // ঐ সময়ের পরের গুলো
    }
  }

  // একবারে কতগুলো আনা হবে — সর্বোচ্চ 500 এ সীমাবদ্ধ
  const maxDocs = Math.min(Number(limit) || 200, 500);

  const patients = await PatientTriage.find(filter) // filter প্রয়োগ
    .populate('reviewedBy', 'name staffRole') // review করা staff-এর নাম
    .populate('forwardedTo', 'name staffRole') // forward করা staff-এর নাম
    .sort({ screenedAt: -1 }) // প্রথমে সময় অনুযায়ী
    .limit(maxDocs); // সীমা প্রয়োগ

  const patientIds = patients.map((p) => p._id); // এদের id গুলো
  const chatSessions = await ChatSession.find({ triageId: { $in: patientIds } }); // এক query-তে সব chat

  // দ্রুত খোঁজার জন্য triageId → session এর Map বানানো (আগে প্রতি রোগীতে find() হতো)
  const sessionMap = new Map(); // key = triageId string
  chatSessions.forEach((cs) => sessionMap.set(cs.triageId.toString(), cs)); // Map ভরা হচ্ছে

  const formatted = patients.map((p) => formatPatient(p, sessionMap.get(p._id.toString()))); // সাজানো

  // ── Priority queue sorting (Proposal: Red first) ──
  formatted.sort((a, b) => {
    // pending রোগী সব সময় reviewed রোগীর উপরে
    const aPending = a.reviewStatus === 'pending' ? 1 : 0; // pending হলে 1
    const bPending = b.reviewStatus === 'pending' ? 1 : 0; // pending হলে 1
    if (aPending !== bPending) return bPending - aPending; // pending আগে

    // এরপর severity অনুযায়ী — Red → Yellow → Green
    const aRank = SEVERITY_PRIORITY[a.category] || 0; // a-এর priority
    const bRank = SEVERITY_PRIORITY[b.category] || 0; // b-এর priority
    if (aRank !== bRank) return bRank - aRank; // বড় priority আগে

    // সব সমান হলে নতুন screening আগে
    return new Date(b.screenedAt) - new Date(a.screenedAt); // সময় অনুযায়ী
  });

  res.json(formatted); // array হিসেবেই ফেরত (frontend contract অপরিবর্তিত)
});

/**
 * PUT /api/triage/patients/:id/status
 * staff রোগীর review status পরিবর্তন করে; প্রতিটি পরিবর্তন audit হয়.
 */
export const updatePatientStatus = asyncHandler(async (req, res) => {
  const { id } = req.params; // triage record id
  const { reviewStatus, reviewComment, forwardedTo } = req.body; // যা পরিবর্তন হবে

  const patient = await PatientTriage.findById(id); // record খোঁজা
  // না পাওয়া গেলে 404
  if (!patient) {
    return res.status(404).json({ message: 'Patient triage record not found' });
  }

  // reviewStatus দেওয়া থাকলে সেটি বৈধ কিনা যাচাই
  if (reviewStatus && !REVIEW_STATUSES.includes(reviewStatus)) {
    return res.status(400).json({ message: `Invalid reviewStatus. Allowed: ${REVIEW_STATUSES.join(', ')}` });
  }

  if (reviewStatus) patient.reviewStatus = reviewStatus; // status হালনাগাদ
  if (reviewComment !== undefined) patient.reviewComment = reviewComment; // মন্তব্য হালনাগাদ
  if (forwardedTo !== undefined) patient.forwardedTo = forwardedTo || null; // forward হালনাগাদ

  patient.reviewedBy = req.user._id; // কে পরিবর্তন করল
  patient.reviewedAt = new Date(); // কখন করল

  await patient.save(); // সংরক্ষণ

  // ── audit trail: এই action টি StaffAction collection-এ লেখা হচ্ছে ──
  await StaffAction.create({
    submissionId: patient._id, // কোন record
    staffId: req.user._id, // কোন staff
    staffName: req.user.name, // নাম সংরক্ষণ
    actionType: forwardedTo ? 'ASSIGNED' : 'STATUS_UPDATE', // forward হলে ASSIGNED
    status: patient.reviewStatus, // action-এর পর status
    note: reviewComment || '', // মন্তব্য
  });

  // populate সহ হালনাগাদ record আবার আনা হচ্ছে
  const updated = await PatientTriage.findById(id)
    .populate('reviewedBy', 'name staffRole') // review করা staff
    .populate('forwardedTo', 'name staffRole'); // forward করা staff

  const session = await ChatSession.findOne({ triageId: id }); // chat history

  res.json(formatPatient(updated, session)); // একই helper দিয়ে সাজিয়ে ফেরত
});

/**
 * POST /api/triage/patients/:id/notes
 * staff clinical note যোগ করে; note-ও audit trail-এ যায়.
 */
export const addPatientNote = asyncHandler(async (req, res) => {
  const { id } = req.params; // triage record id
  const { text } = req.body; // note-এর লেখা

  const patient = await PatientTriage.findById(id); // record খোঁজা
  // না পাওয়া গেলে 404
  if (!patient) {
    return res.status(404).json({ message: 'Patient triage record not found' });
  }

  // note লেখকের নাম — staffRole থাকলে বন্ধনীতে যোগ হয়
  const authorLabel = req.user.name + (req.user.staffRole ? ` (${req.user.staffRole})` : '');

  patient.notes.push({
    author: authorLabel, // লেখকের নাম
    authorId: req.user._id, // লেখকের id
    text: String(text).trim(), // পরিষ্কার লেখা
    timestamp: new Date(), // সময়
  });

  await patient.save(); // সংরক্ষণ

  // audit trail-এ note যোগ হওয়ার তথ্য
  await StaffAction.create({
    submissionId: patient._id, // কোন record
    staffId: req.user._id, // কোন staff
    staffName: req.user.name, // নাম
    actionType: 'NOTE_ADDED', // action ধরন
    status: patient.reviewStatus, // বর্তমান status
    note: String(text).trim().slice(0, 200), // সংক্ষিপ্ত অংশ
  });

  res.status(201).json(patient.notes); // পুরো note তালিকা ফেরত (আগের contract)
});

/**
 * GET /api/triage/stats
 * Doctor dashboard-এর উপরের counter গুলোর জন্য — এক query-তেই হিসাব হয়.
 */
export const getTriageStats = asyncHandler(async (req, res) => {
  // MongoDB aggregation দিয়ে label + status ভিত্তিক গণনা
  const rows = await PatientTriage.aggregate([
    {
      $group: {
        _id: { label: '$finalLabel', status: '$reviewStatus' }, // দুই field ধরে group
        count: { $sum: 1 }, // প্রতিটি group-এ কতগুলো
      },
    },
  ]);

  // শুরুতে সব শূন্য দিয়ে একটি কাঠামো তৈরি
  const stats = {
    total: 0, // মোট record
    active: { red: 0, yellow: 0, green: 0 }, // pending অবস্থায়
    reviewed: { red: 0, yellow: 0, green: 0 }, // review হয়ে যাওয়া
  };

  // aggregation ফলাফল ঘুরে ঘুরে হিসাব বসানো
  rows.forEach((row) => {
    const label = row._id.label || 'green'; // label না থাকলে green
    const bucket = row._id.status === 'pending' ? 'active' : 'reviewed'; // কোন বালতিতে যাবে
    if (stats[bucket][label] !== undefined) stats[bucket][label] += row.count; // গণনা যোগ
    stats.total += row.count; // মোট বাড়ানো
  });

  res.json(stats); // হিসাব ফেরত
});

/**
 * GET /api/triage/patients/:id/actions
 * একটি রোগীর উপর নেওয়া সব staff action (audit trail) ফেরত দেয়.
 */
export const getPatientActions = asyncHandler(async (req, res) => {
  const actions = await StaffAction.find({ submissionId: req.params.id }) // ঐ record-এর action
    .sort({ createdAt: -1 }) // নতুন গুলো আগে
    .limit(100); // সর্বোচ্চ 100

  res.json(actions); // তালিকা ফেরত
});
