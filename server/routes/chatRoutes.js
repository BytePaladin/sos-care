import express from 'express';
import { createChatSession, sendMessage, getUserChats } from '../controllers/chatController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/', createChatSession);
router.post('/:id/messages', sendMessage);
router.get('/my-chats', protect, getUserChats);

export default router;
