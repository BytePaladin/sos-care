/**
 * chatController.js
 * Week 3 update:
 *  - Math.random() ভিত্তিক ভুয়া severity সম্পূর্ণ বাদ দেওয়া হয়েছে.
 *  - এখন triageEngine (ML classifier + safety-net override) ব্যবহার হচ্ছে.
 *  - session ownership যাচাই যোগ হয়েছে, যাতে অন্য কেউ অন্যের chat-এ লিখতে না পারে.
 */

import { ChatSession } from '../models/ChatSession.js'; // chat session model
import { PatientTriage } from '../models/PatientTriage.js'; // triage record model
import { asyncHandler } from '../utils/asyncHandler.js'; // try/catch wrapper
import { SEVERITY } from '../utils/severity.js'; // severity constant
import { evaluateMessage, buildPatientReply, buildAiAnalysis } from '../services/triageEngine.js'; // hybrid engine

/**
 * POST /api/chats
 * নতুন screening session ও তার সাথে একটি triage record তৈরি করে.
 */
export const createChatSession = asyncHandler(async (req, res) => {
  const userId = req.user ? req.user._id : null; // login করা থাকলে user id
  const patientName = req.user ? req.user.name : req.body.patientName || 'Anonymous Patient'; // নাম নির্ধারণ
  const patientPhone = req.user ? req.user.phone : req.body.patientPhone || 'N/A'; // ফোন নির্ধারণ

  // প্রথমে triage record তৈরি — শুরুতে সবাই green এবং pending
  const triage = await PatientTriage.create({
    patientName, // রোগীর নাম
    patientPhone, // রোগীর ফোন
    userId, // কোন account থেকে এসেছে
    category: SEVERITY.GREEN, // শুরুতে routine
    finalLabel: SEVERITY.GREEN, // audit field-ও একই
    mlLabel: SEVERITY.GREEN, // এখনো কোনো message আসেনি
    reviewStatus: 'pending', // staff এখনো দেখেনি
  });

  // এরপর chat session তৈরি, প্রথম bot greeting সহ
  const session = await ChatSession.create({
    triageId: triage._id, // কোন triage record-এর সাথে যুক্ত
    userId, // session-এর মালিক
    title: 'Symptom Screening Session', // default title
    status: 'active', // চলমান session
    messages: [
      {
        sender: 'bot', // প্রথম বার্তা bot-এর
        text: 'Hello! I am the S.O.S. Symptom Screener. Please describe how you are feeling in your own words. This is a triage assistant — it does not diagnose or replace your doctor.',
        timestamp: new Date(), // সময়
      },
    ],
  });

  // frontend-এর জন্য দরকারি id গুলো ফেরত পাঠানো হচ্ছে
  res.status(201).json({
    sessionId: session._id, // পরে message পাঠাতে লাগবে
    triageId: triage._id, // staff dashboard-এ খুঁজতে লাগবে
    messages: session.messages, // শুরুর বার্তা
  });
});

/**
 * POST /api/chats/:id/messages
 * রোগীর message নেয় → hybrid triage চালায় → label সংরক্ষণ করে → bot reply দেয়.
 */
export const sendMessage = asyncHandler(async (req, res) => {
  const { id } = req.params; // session id
  const { text } = req.body; // রোগীর লেখা message

  const session = await ChatSession.findById(id); // session খোঁজা
  // session না থাকলে 404
  if (!session) {
    return res.status(404).json({ message: 'Chat session not found' });
  }

  // ownership যাচাই: session-এর মালিক থাকলে শুধু সে বা staff লিখতে পারবে
  if (session.userId) {
    const isOwner = req.user && req.user._id.toString() === session.userId.toString(); // মালিক কিনা
    const isStaff = req.user && req.user.role === 'staff'; // staff কিনা
    if (!isOwner && !isStaff) {
      return res.status(403).json({ message: 'Access denied: this session belongs to another user' });
    }
  }

  const cleanText = String(text).trim(); // সামনে-পিছনের space বাদ (validate middleware আগেই ফাঁকা আটকায়)

  // ── ধাপ ১: রোগীর message session-এ যোগ করা ──
  session.messages.push({
    sender: 'user', // প্রেরক রোগী
    text: cleanText, // মূল লেখা
    timestamp: new Date(), // সময়
  });

  // ── ধাপ ২: hybrid triage — ML classifier + deterministic safety-net ──
  const decision = await evaluateMessage(cleanText); // পূর্ণ সিদ্ধান্ত (audit সহ)

  // ── ধাপ ৩: রোগীকে দেখানোর bot reply তৈরি ──
  session.messages.push({
    sender: 'bot', // প্রেরক bot
    text: buildPatientReply(decision.finalLabel, decision.ruleOverride), // label অনুযায়ী বার্তা
    metadata: {
      finalLabel: decision.finalLabel, // কোন tier দেওয়া হয়েছে
      ruleOverride: decision.ruleOverride, // safety-net চালু হয়েছিল কিনা
    },
    timestamp: new Date(), // সময়
  });

  // RED হলে session কে flagged চিহ্নিত করা হয় যাতে dashboard-এ আলাদা দেখায়
  if (decision.finalLabel === SEVERITY.RED) {
    session.status = 'flagged_red'; // status পরিবর্তন
  }

  // ── ধাপ ৪: triage record হালনাগাদ (escalate-only নিয়ম) ──
  const triage = await PatientTriage.findById(session.triageId); // যুক্ত triage record

  if (triage) {
    // একটি session-এ আগে RED হয়ে থাকলে পরে green message এলেও নামানো হবে না
    const alreadyRed = triage.finalLabel === SEVERITY.RED; // আগে থেকেই red ছিল কিনা
    const nextLabel = alreadyRed ? SEVERITY.RED : decision.finalLabel; // escalate-only

    triage.mlLabel = decision.mlLabel; // model কী বলেছিল
    triage.ruleOverride = decision.ruleOverride || triage.ruleOverride; // একবার true হলে true-ই থাকবে
    triage.matchedKeywords = [...new Set([...(triage.matchedKeywords || []), ...decision.matchedKeywords])]; // ডুপ্লিকেট বাদ
    triage.modelSource = decision.modelSource; // ml-service নাকি fallback
    triage.finalLabel = nextLabel; // চূড়ান্ত label (pre-save hook category-ও sync করবে)
    triage.aiAnalysis = buildAiAnalysis(cleanText, decision); // সারাংশ ও tag হালনাগাদ
    triage.screenedAt = new Date(); // সর্বশেষ screening সময়

    // safety-net চালু হলে system note হিসেবে কারণ লিখে রাখা হয় (audit trail)
    if (decision.ruleOverride) {
      triage.notes.push({
        author: 'System (Safety-Net)', // কে যোগ করল
        text: `Force-escalated to RED. Rule hits: ${decision.matchedKeywords.join(', ')}. ML label was: ${decision.mlLabel}.`,
        timestamp: new Date(), // সময়
      });
    }

    await triage.save(); // hook চালানোর জন্য save() ব্যবহার (findByIdAndUpdate নয়)
  }

  await session.save(); // chat session সংরক্ষণ

  // frontend-এর পুরনো contract অনুযায়ী message array ফেরত যাচ্ছে
  res.json(session.messages);
});

/**
 * GET /api/chats/my-chats
 * login করা রোগীর নিজের সব session ফেরত দেয়.
 */
export const getUserChats = asyncHandler(async (req, res) => {
  const chats = await ChatSession.find({ userId: req.user._id }) // শুধু নিজের session
    .sort({ updatedAt: -1 }); // নতুন গুলো আগে

  res.json(chats); // তালিকা ফেরত
});

/**
 * GET /api/chats/:id
 * একটি নির্দিষ্ট session-এর পূর্ণ বিবরণ (মালিক অথবা staff দেখতে পারবে).
 */
export const getChatSession = asyncHandler(async (req, res) => {
  const session = await ChatSession.findById(req.params.id); // session আনা

  // না থাকলে 404
  if (!session) {
    return res.status(404).json({ message: 'Chat session not found' });
  }

  // মালিক থাকলে অনুমতি যাচাই করা হয়
  if (session.userId) {
    const isOwner = req.user && req.user._id.toString() === session.userId.toString(); // মালিক কিনা
    const isStaff = req.user && req.user.role === 'staff'; // staff কিনা
    if (!isOwner && !isStaff) {
      return res.status(403).json({ message: 'Access denied' }); // অন্য কেউ হলে 403
    }
  }

  res.json(session); // session ফেরত
});
