/**
 * notificationService.js
 * --------------------------------------------------------------------------
 * Week 5: creates notification documents and fans them out to staff.
 *
 * The controllers call these helpers; they never build Notification documents
 * themselves. Keeping the fan-out rules in one file means the answer to
 * "who gets alerted when a case turns Red?" lives in exactly one place.
 *
 * Design rule: a notification failure must never fail the request that
 * triggered it. A patient's message must still be saved even if the alert
 * write fails, so every function here swallows its own errors and logs them.
 * --------------------------------------------------------------------------
 */

import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';

/**
 * Returns the _id of every staff and admin account.
 * `.lean()` is used because only the ids are needed — no need to hydrate
 * full Mongoose documents for what is effectively a lookup table.
 */
const getRecipientIds = async () => {
  const recipients = await User.find({ role: { $in: ['staff', 'admin'] } })
    .select('_id')
    .lean();
  return recipients.map((r) => r._id);
};

/**
 * Broadcasts an alert to every staff member.
 *
 * De-duplication: a patient may send several Red messages in one session.
 * Without a guard each one would produce a fresh alert for every staff member
 * and the bell would fill with copies of the same case. So an alert of the
 * same type for the same submission is only created if no unread one exists.
 *
 * @param {object} args
 * @param {string} args.submissionId — the PatientTriage record
 * @param {string} args.notificationType — one of NOTIFICATION_TYPES
 * @param {string} args.title — one-line summary shown in the bell
 * @param {string} [args.body] — optional detail line
 * @param {string} [args.severity] — colour coding for the dashboard
 * @param {string} [args.patientName] — denormalised for display
 * @returns {Promise<number>} how many notifications were created
 */
export const notifyAllStaff = async ({
  submissionId,
  notificationType,
  title,
  body = '',
  severity = 'red',
  patientName = '',
}) => {
  try {
    const recipientIds = await getRecipientIds();
    if (recipientIds.length === 0) return 0; // no staff seeded yet — nothing to do

    // Who already has an unread alert of this type for this case
    const existing = await Notification.find({
      submissionId,
      notificationType,
      isRead: false,
    })
      .select('staffId')
      .lean();

    const alreadyNotified = new Set(existing.map((e) => e.staffId.toString()));

    const docs = recipientIds
      .filter((id) => !alreadyNotified.has(id.toString()))
      .map((staffId) => ({
        submissionId,
        staffId,
        notificationType,
        title,
        body,
        severity,
        patientName,
      }));

    if (docs.length === 0) return 0; // everyone already has an unread copy

    await Notification.insertMany(docs); // one write instead of N
    console.log(`[Notify] ${notificationType} → ${docs.length} staff (case ${submissionId})`);
    return docs.length;
  } catch (error) {
    // Deliberately swallowed: see the design rule at the top of this file
    console.error(`[Notify] Failed to broadcast ${notificationType}: ${error.message}`);
    return 0;
  }
};

/**
 * Sends an alert to a single staff member — used when a case is forwarded
 * to a named colleague rather than broadcast to the whole team.
 */
export const notifyOneStaff = async ({
  submissionId,
  staffId,
  notificationType,
  title,
  body = '',
  severity = 'yellow',
  patientName = '',
}) => {
  try {
    if (!staffId) return 0; // nobody to notify

    await Notification.create({
      submissionId,
      staffId,
      notificationType,
      title,
      body,
      severity,
      patientName,
    });

    console.log(`[Notify] ${notificationType} → staff ${staffId} (case ${submissionId})`);
    return 1;
  } catch (error) {
    console.error(`[Notify] Failed to notify staff ${staffId}: ${error.message}`);
    return 0;
  }
};

/**
 * Convenience wrapper for the most important case in the whole system:
 * the safety net (or the classifier) has marked a message urgent.
 *
 * The title states plainly whether the escalation came from the deterministic
 * rule layer or from the model, because a clinician triaging a queue should
 * be able to see the provenance of an alert without opening the case.
 */
export const notifyRedCase = async ({ triage, matchedKeywords = [], ruleOverride = false }) => {
  const reason = ruleOverride
    ? `Safety-net escalation (${matchedKeywords.join(', ') || 'critical keyword'})`
    : 'Classifier marked this message urgent';

  return notifyAllStaff({
    submissionId: triage._id,
    notificationType: 'NEW_RED_ALERT',
    title: `URGENT: ${triage.patientName} flagged RED`,
    body: reason,
    severity: 'red',
    patientName: triage.patientName,
  });
};
