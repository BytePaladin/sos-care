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
import { buildPatientReply, buildAiAnalysis } from '../services/triageEngine.js'; // hybrid engine
import { notifyRedCase } from '../services/notificationService.js'; // Week 5: staff alert on Red

/**
 * POST /api/chats
 * Creates a new screening session along with a triage record.
 */
export const createChatSession = asyncHandler(async (req, res) => {
  const userId = req.user ? req.user._id : null; // user id if logged in
  const patientName = req.user ? req.user.name : req.body.patientName || 'Anonymous Patient'; // determine name
  const patientPhone = req.user ? req.user.phone : req.body.patientPhone || 'N/A'; // determine phone
  const patientEmail = req.user ? req.user.email : req.body.patientEmail || ''; // determine email

  // Create triage record first — everyone is green and pending initially
  const triage = await PatientTriage.create({
    patientName, // patient's name
    patientPhone, // patient's phone
    patientEmail, // patient's email
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
 * Takes patient's message → uses frontend decision → saves label → gives bot reply.
 */
export const sendMessage = asyncHandler(async (req, res) => {
  const { id } = req.params; // session id
  const { text, decision } = req.body; // message written by patient and ML decision from frontend

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

  // ── Step 2: Ensure decision is present (Fallback if frontend didn't send one) ──
  const finalDecision = decision || {
    mlLabel: SEVERITY.GREEN,
    confidence: 1.0,
    modelSource: 'fallback-no-decision',
    topFeatures: [],
    ruleOverride: false,
    matchedKeywords: [],
    finalLabel: SEVERITY.GREEN,
  };

  // ── Step 3: Create bot reply to show patient ──
  session.messages.push({
    sender: 'bot', // sender is bot
    text: buildPatientReply(finalDecision.finalLabel, finalDecision.ruleOverride), // message according to label
    metadata: {
      finalLabel: finalDecision.finalLabel, // which tier was given
      ruleOverride: finalDecision.ruleOverride, // whether safety-net was triggered
    },
    timestamp: new Date(), // time
  });

  // If RED, session is marked flagged so it shows differently in dashboard
  if (finalDecision.finalLabel === SEVERITY.RED) {
    session.status = 'flagged_red'; // status change
  }

  // ── Step 4: Update triage record (escalate-only rule) ──
  const triage = await PatientTriage.findById(session.triageId); // linked triage record

  if (triage) {
    // If it was RED before in a session, it won't be downgraded even if green message comes later
    const alreadyRed = triage.finalLabel === SEVERITY.RED; // whether it was already red
    const nextLabel = alreadyRed ? SEVERITY.RED : finalDecision.finalLabel; // escalate-only

    triage.mlLabel = finalDecision.mlLabel; // what model said
    triage.ruleOverride = finalDecision.ruleOverride || triage.ruleOverride; // once true, remains true
    triage.matchedKeywords = [...new Set([...(triage.matchedKeywords || []), ...finalDecision.matchedKeywords])]; // remove duplicates
    triage.modelSource = finalDecision.modelSource; // ml-service or fallback
    triage.finalLabel = nextLabel; // final label (pre-save hook will also sync category)
    triage.category = nextLabel;
    if (!triage.doctorOverride?.isOverridden) {
      triage.initialCategory = nextLabel; // sync automated AI tier
    }
    triage.aiAnalysis = buildAiAnalysis(cleanText, finalDecision); // update summary and tag
    triage.screenedAt = new Date(); // last screening time
    triage.reviewStatus = 'pending'; // MUST reset to pending so staff see the new data

    // if safety-net triggered, reason is written as system note (audit trail)
    if (finalDecision.ruleOverride) {
      triage.notes.push({
        author: 'System (Safety-Net)', // who added it
        text: `Force-escalated to RED. Rule hits: ${finalDecision.matchedKeywords.join(', ')}. ML label was: ${finalDecision.mlLabel}.`,
        timestamp: new Date(), // time
      });
    }

    await triage.save(); // using save() instead of findByIdAndUpdate to trigger hook

    // ── Week 5: raise a staff alert when the case is urgent ──
    // Previously a Red case was only noticed if someone happened to be
    // watching the dashboard. Now the backend records the alert, so it
    // survives a refresh and each staff member keeps their own read state.
    // Awaited (not fired and forgotten) so the alert is guaranteed to exist
    // before the patient is told their case was escalated; the service
    // swallows its own errors, so this cannot fail the message.
    if (nextLabel === SEVERITY.RED) {
      await notifyRedCase({
        triage, // for _id and patientName
        matchedKeywords: finalDecision.matchedKeywords, // which rules fired
        ruleOverride: finalDecision.ruleOverride, // safety-net or classifier
      });
    }
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
