/**
 * chatRoutes.js
 * Week 3 update: সব chat route এখন optionalAuth-এর ভেতর দিয়ে যায় (anonymous
 * screening চালু থাকে), আর body validation middleware যোগ করা হয়েছে.
 */

import express from 'express'; // router তৈরির জন্য
import {
  createChatSession, // নতুন session
  sendMessage, // message পাঠানো
  getUserChats, // নিজের session তালিকা
  getChatSession, // একটি session বিস্তারিত
} from '../controllers/chatController.js';
import { protect, optionalAuth } from '../middleware/auth.js'; // auth middleware
import { requireFields, validateObjectId, maxLength } from '../middleware/validate.js'; // validation

const router = express.Router(); // router instance

// নতুন screening session — login না থাকলেও কাজ করবে
router.post('/', optionalAuth, createChatSession);

// নিজের সব chat — এখানে login বাধ্যতামূলক
router.get('/my-chats', protect, getUserChats);

// একটি নির্দিষ্ট session দেখা — মালিক অথবা staff
router.get('/:id', optionalAuth, validateObjectId('id'), getChatSession);

// message পাঠানো — id বৈধ কিনা, text আছে কিনা, খুব বড় কিনা — সব যাচাই হয়
router.post(
  '/:id/messages', // route path
  optionalAuth, // token থাকলে user বসবে
  validateObjectId('id'), // session id বৈধ ObjectId কিনা
  requireFields(['text']), // text অবশ্যই লাগবে
  maxLength('text', 2000), // সর্বোচ্চ 2000 character
  sendMessage // controller
);

export default router; // index.js এ mount হবে
