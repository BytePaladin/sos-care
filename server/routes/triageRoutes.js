import express from 'express';
import {
  getPatients,
  updatePatientStatus,
  addPatientNote,
} from '../controllers/triageController.js';
import { protect, requireStaff } from '../middleware/auth.js';

const router = express.Router();

router.get('/patients', protect, requireStaff, getPatients);
router.put('/patients/:id/status', protect, requireStaff, updatePatientStatus);
router.post('/patients/:id/notes', protect, requireStaff, addPatientNote);

export default router;
