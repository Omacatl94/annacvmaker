// server/services/notifications.js

const VALID_TYPES = new Set([
  'credits_received',
  'credits_purchased',
  'feedback_rewarded',
  'welcome_activated',
]);

/**
 * Insert a notification for a user. Fire-and-forget safe.
 * @param {object} db - database pool
 * @param {string} userId - recipient user ID
 * @param {string} type - one of VALID_TYPES
 * @param {object} data - type-specific payload
 */
export async function notify(db, userId, type, data = {}) {
  if (!userId || !VALID_TYPES.has(type)) return;
  await db.query(
    'INSERT INTO notifications (user_id, type, data) VALUES ($1, $2, $3)',
    [userId, type, JSON.stringify(data)]
  );
}

export { VALID_TYPES };
