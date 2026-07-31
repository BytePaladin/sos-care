/**
 * chatController.js
 * Week 3 update:
 *  - Math.random() based dummy severity is completely removed.
 *  - Now triageEngine (ML classifier + safety-net override) is being used.
 *  - session ownership verification added, so others cannot write in someone else's chat.
 */

import { ChatSession } from '../models/ChatSession.js'; // chat session model
import { PatientTriage } from '../models/PatientTriage.js'; // triage record model
import { asyncHandler } from '../utils/asyncHandler.js'; // try/catch wrapper
import { SEVERITY } from '../utils/severity.js'; // severity constant
import { evaluateMessage, buildPatientReply, buildAiAnalysis } from '../services/triageEngine.js'; // hybrid engine

/**
 * POST /api/chats
 * Creates a new screening session along with a triage record.
 */
export const createChatSession = asyncHandler(async (req, res) => {
  const userId = req.user ? req.user._id : null; // user id if logged in
  const patientName = req.user ? req.user.name : req.body.patientName || 'Anonymous Patient'; // determine name
  const patientPhone = req.user ? req.user.phone : req.body.patientPhone || 'N/A'; // determine phone

  // Create triage record first — everyone is green and pending initially
  const triage = await PatientTriage.create({
    patientName, // patient's name
    patientPhone, // patient's phone
    userId, // from which account it came
    category: SEVERITY.GREEN, // initially routine
    finalLabel: SEVERITY.GREEN, // audit field is also the same
    mlLabel: SEVERITY.GREEN, // no message arrived yet
    reviewStatus: 'pending', // staff hasn't seen yet
  });

  // Then create chat session, with initial bot greeting
  const session = await ChatSession.create({
    triageId: triage._id, // which triage record it's linked to
    userId, // owner of the session
    title: 'Symptom Screening Session', // default title
    status: 'active', // active session
    messages: [
      {
        sender: 'bot', // first message is from bot
        text: 'Hello! I am the S.O.S. Symptom Screener. Please describe how you are feeling in your own words. This is a triage assistant — it does not diagnose or replace your doctor.',
        timestamp: new Date(), // time
      },
    ],
  });

  // Returning required ids for frontend
  res.status(201).json({
    sessionId: session._id, // needed to send message later
    triageId: triage._id, // needed to find in staff dashboard
    messages: session.messages, // initial message
  });
});

/**
 * POST /api/chats/:id/messages
 * Takes patient's message → runs hybrid triage → saves label → gives bot reply.
 */
export const sendMessage = asyncHandler(async (req, res) => {
  const { id } = req.params; // session id
  const { text } = req.body; // message written by patient

  const session = await ChatSession.findById(id); // find session
  // if session not found, 404
  if (!session) {
    return res.status(404).json({ message: 'Chat session not found' });
  }

  // verify ownership: if session has owner, only they or staff can write
  if (session.userId) {
    const isOwner = req.user && req.user._id.toString() === session.userId.toString(); // is owner
    const isStaff = req.user && req.user.role === 'staff'; // is staff
    if (!isOwner && !isStaff) {
      return res.status(403).json({ message: 'Access denied: this session belongs to another user' });
    }
  }

  const cleanText = String(text).trim(); // remove leading-trailing spaces (validate middleware blocks empty beforehand)

  // ── Step 1: Add patient's message to session ──
  session.messages.push({
    sender: 'user', // sender is patient
    text: cleanText, // main text
    timestamp: new Date(), // time
  });

  // ── Step 2: hybrid triage — ML classifier + deterministic safety-net ──
  const decision = await evaluateMessage(cleanText); // full decision (with audit)

  // ── Step 3: Create bot reply to show patient ──
  session.messages.push({
    sender: 'bot', // sender is bot
    text: buildPatientReply(decision.finalLabel, decision.ruleOverride), // message according to label
    metadata: {
      finalLabel: decision.finalLabel, // which tier was given
      ruleOverride: decision.ruleOverride, // whether safety-net was triggered
    },
    timestamp: new Date(), // time
  });

  // If RED, session is marked flagged so it shows differently in dashboard
  if (decision.finalLabel === SEVERITY.RED) {
    session.status = 'flagged_red'; // status change
  }

  // ── Step 4: Update triage record (escalate-only rule) ──
  const triage = await PatientTriage.findById(session.triageId); // linked triage record

  if (triage) {
    // If it was RED before in a session, it won't be downgraded even if green message comes later
    const alreadyRed = triage.finalLabel === SEVERITY.RED; // whether it was already red
    const nextLabel = alreadyRed ? SEVERITY.RED : decision.finalLabel; // escalate-only

    triage.mlLabel = decision.mlLabel; // what model said
    triage.ruleOverride = decision.ruleOverride || triage.ruleOverride; // once true, remains true
    triage.matchedKeywords = [...new Set([...(triage.matchedKeywords || []), ...decision.matchedKeywords])]; // remove duplicates
    triage.modelSource = decision.modelSource; // ml-service or fallback
    triage.finalLabel = nextLabel; // final label (pre-save hook will also sync category)
    triage.aiAnalysis = buildAiAnalysis(cleanText, decision); // update summary and tag
    triage.screenedAt = new Date(); // last screening time

    // if safety-net triggered, reason is written as system note (audit trail)
    if (decision.ruleOverride) {
      triage.notes.push({
        author: 'System (Safety-Net)', // who added it
        text: `Force-escalated to RED. Rule hits: ${decision.matchedKeywords.join(', ')}. ML label was: ${decision.mlLabel}.`,
        timestamp: new Date(), // time
      });
    }

    await triage.save(); // using save() instead of findByIdAndUpdate to trigger hook
  }

  await session.save(); // save chat session

  // return message array to match old frontend contract
  res.json(session.messages);
});

/**
 * GET /api/chats/my-chats
 * Returns all sessions for the logged-in patient.
 */
export const getUserChats = asyncHandler(async (req, res) => {
  const chats = await ChatSession.find({ userId: req.user._id }) // only their own sessions
    .sort({ updatedAt: -1 }); // newest first

  res.json(chats); // return list
});

/**
 * GET /api/chats/:id
 * Fetches the full details of a specific session (viewable by owner or staff).
 */
export const getChatSession = asyncHandler(async (req, res) => {
  const session = await ChatSession.findById(req.params.id); // fetch session

  // if not found, 404
  if (!session) {
    return res.status(404).json({ message: 'Chat session not found' });
  }

  // verify ownership if session is owned
  if (session.userId) {
    const isOwner = req.user && req.user._id.toString() === session.userId.toString(); // is owner
    const isStaff = req.user && req.user.role === 'staff'; // is staff
    if (!isOwner && !isStaff) {
      return res.status(403).json({ message: 'Access denied' }); // 403 for unauthorized access
    }
  }

  res.json(session); // return session
});
