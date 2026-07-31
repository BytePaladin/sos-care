/**
 * chatRoutes.js
 * Week 3 update: All chat routes now go through optionalAuth (anonymous
 * screening is enabled), and body validation middleware is added.
 */

import express from 'express'; // for creating router
import {
  createChatSession, // new session
  sendMessage, // send message
  getUserChats, // list of own sessions
  getChatSession, // session details
} from '../controllers/chatController.js';
import { protect, optionalAuth } from '../middleware/auth.js'; // auth middleware
import { requireFields, validateObjectId, maxLength } from '../middleware/validate.js'; // validation

const router = express.Router(); // router instance

// New screening session — works without login
router.post('/', optionalAuth, createChatSession);

// All own chats — login is mandatory here
router.get('/my-chats', protect, getUserChats);

// View a specific session — owner or staff
router.get('/:id', optionalAuth, validateObjectId('id'), getChatSession);

// Send message — id validity, text presence, max length checks
router.post(
  '/:id/messages', // route path
  optionalAuth, // user will be populated if token exists
  validateObjectId('id'), // is session id a valid ObjectId
  requireFields(['text']), // text is mandatory
  maxLength('text', 2000), // max 2000 characters
  sendMessage // controller
);

export default router; // will be mounted in index.js
