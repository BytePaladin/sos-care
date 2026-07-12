// ============================================================
// src/routes/index.js
// Kaj: shob route module ke ek jaygay mount kore.
// Bhobisshot e submissionRoutes, staffRoutes ekhane add hobe.
// ============================================================

import express from 'express';
import authRoutes from './authRoutes.js';

const router = express.Router();

// GET /api/health — server + DB beche ache kina check korar jonno
router.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'S.O.S. API is running',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

// /api/auth/* -> authRoutes
router.use('/auth', authRoutes);

// TODO (Week 3): router.use('/submissions', submissionRoutes);
// TODO (Week 4): router.use('/staff', staffRoutes);

export default router;
