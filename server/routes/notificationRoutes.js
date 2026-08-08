/**
 * notificationRoutes.js
 * Week 5: the staff notification bell.
 *
 * As with triageRoutes, protect + requireStaff are applied once at router
 * level, so a route added here later cannot accidentally be left open.
 */

import express from 'express';
import {
  getMyNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '../controllers/notificationController.js';
import { protect, requireStaff } from '../middleware/auth.js';
import { validateObjectId } from '../middleware/validate.js';

const router = express.Router();

router.use(protect, requireStaff); // every route below is staff-only

router.get('/', getMyNotifications); // my alerts
router.get('/unread-count', getUnreadCount); // badge count only

// read-all is declared before /:id/read so that the literal path is matched
// first — otherwise Express would try to read "read-all" as an :id
router.put('/read-all', markAllNotificationsRead);
router.put('/:id/read', validateObjectId('id'), markNotificationRead);

export default router;
