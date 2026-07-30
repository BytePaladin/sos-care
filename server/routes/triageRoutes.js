/**
 * triageRoutes.js
 * Week 3 update: stats ও audit-trail route যোগ, প্রতিটি :id param এখন validate হয়.
 * সব route এখনো protect + requireStaff এর পেছনে — রোগী এগুলো দেখতে পারবে না.
 */

import express from 'express'; // router তৈরির জন্য
import {
  getPatients, // priority queue
  updatePatientStatus, // status পরিবর্তন
  addPatientNote, // note যোগ
  getTriageStats, // dashboard counter
  getPatientActions, // audit trail
} from '../controllers/triageController.js';
import { protect, requireStaff } from '../middleware/auth.js'; // auth middleware
import { requireFields, validateObjectId, maxLength } from '../middleware/validate.js'; // validation

const router = express.Router(); // router instance

// এই router-এর সব route-এ আগে login, তারপর staff role যাচাই হবে
router.use(protect, requireStaff); // এক লাইনেই সবার জন্য প্রযোজ্য

// priority queue — filter query param সমর্থন করে
router.get('/patients', getPatients);

// dashboard-এর উপরের counter গুলো
router.get('/stats', getTriageStats);

// status পরিবর্তন
router.put('/patients/:id/status', validateObjectId('id'), updatePatientStatus);

// clinical note যোগ
router.post(
  '/patients/:id/notes', // route path
  validateObjectId('id'), // id যাচাই
  requireFields(['text']), // note ফাঁকা হতে পারবে না
  maxLength('text', 1000), // সর্বোচ্চ 1000 character
  addPatientNote // controller
);

// একটি রোগীর উপর নেওয়া সব staff action
router.get('/patients/:id/actions', validateObjectId('id'), getPatientActions);

export default router; // index.js এ mount হবে
