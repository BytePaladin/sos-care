/**
 * notificationController.js
 * --------------------------------------------------------------------------
 * Week 5: staff-facing endpoints for the notification bell.
 *
 * Every query here is scoped to `req.user._id`. A staff member can only ever
 * read or modify their own copies — the scoping is applied in the query
 * itself rather than checked afterwards, so there is no path that returns
 * another person's alerts.
 * --------------------------------------------------------------------------
 */

import { Notification } from '../models/Notification.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { parsePagination, buildPageMeta, setPageHeaders } from '../utils/pagination.js';

/**
 * GET /api/notifications
 * Query params:
 *   ?unread=true   — only alerts not yet read
 *   ?page=1&limit=25 — opt-in pagination
 */
export const getMyNotifications = asyncHandler(async (req, res) => {
  const filter = { staffId: req.user._id }; // scoped at the query level

  if (req.query.unread === 'true') filter.isRead = false;

  const { wantsPagination, page, limit, skip } = parsePagination(req.query);

  const totalItems = await Notification.countDocuments(filter);

  const notifications = await Notification.find(filter)
    .sort({ isRead: 1, createdAt: -1 }) // unread first, then newest
    .skip(wantsPagination ? skip : 0)
    .limit(wantsPagination ? limit : 50) // unpaginated callers get a sane cap
    .lean();

  const meta = buildPageMeta(totalItems, { page, limit });
  setPageHeaders(res, meta);

  // Envelope only when explicitly requested — see utils/pagination.js
  if (wantsPagination) {
    return res.json({ data: notifications, meta });
  }

  res.json(notifications);
});

/**
 * GET /api/notifications/unread-count
 * Cheap endpoint for the bell badge — the dashboard can poll this without
 * pulling any notification bodies.
 */
export const getUnreadCount = asyncHandler(async (req, res) => {
  const unread = await Notification.countDocuments({ staffId: req.user._id, isRead: false });

  const urgentUnread = await Notification.countDocuments({
    staffId: req.user._id,
    isRead: false,
    severity: 'red',
  });

  res.json({ unread, urgentUnread });
});

/**
 * PUT /api/notifications/:id/read
 * Marks one alert as read.
 */
export const markNotificationRead = asyncHandler(async (req, res) => {
  // staffId is part of the filter, so another user's id simply matches nothing
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, staffId: req.user._id },
    { isRead: true, readAt: new Date() },
    { new: true }
  );

  if (!notification) {
    return res.status(404).json({ message: 'Notification not found' });
  }

  res.json(notification);
});

/**
 * PUT /api/notifications/read-all
 * Clears the badge in one call.
 */
export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    { staffId: req.user._id, isRead: false },
    { isRead: true, readAt: new Date() }
  );

  res.json({
    message: 'All notifications marked as read',
    modifiedCount: result.modifiedCount,
  });
});
