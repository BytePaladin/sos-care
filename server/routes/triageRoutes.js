/**
 * triageRoutes.js
 * Week 3 update: stats and audit-trail routes added, every :id param is now validated.
 * All routes are still behind protect + requireStaff — patients cannot see these.
 */

import express from 'express'; // for creating router
import {
  getPatients, // priority queue
  updatePatientStatus, // update status
  addPatientNote, // add note
  getTriageStats, // dashboard counter
  getPatientActions, // audit trail
} from '../controllers/triageController.js';
import { protect, requireStaff } from '../middleware/auth.js'; // auth middleware
import { requireFields, validateObjectId, maxLength } from '../middleware/validate.js'; // validation

const router = express.Router(); // router instance

// All routes in this router will first verify login, then staff role
router.use(protect, requireStaff); // applies to all in one line

// priority queue — supports filter query params
router.get('/patients', getPatients);

// upper counters of the dashboard
router.get('/stats', getTriageStats);

// update status
router.put('/patients/:id/status', validateObjectId('id'), updatePatientStatus);

// add clinical note
router.post(
  '/patients/:id/notes', // route path
  validateObjectId('id'), // validate id
  requireFields(['text']), // note cannot be empty
  maxLength('text', 1000), // max 1000 characters
  addPatientNote // controller
);

// all staff actions taken on a patient
router.get('/patients/:id/actions', validateObjectId('id'), getPatientActions);

export default router; // will be mounted in index.js
