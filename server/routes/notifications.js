// server/routes/notifications.js
import { activeGuard } from '../middleware/auth-guard.js';

export default async function notificationRoutes(app) {
  app.addHook('preHandler', activeGuard);

  // List recent notifications + unread count
  app.get('/', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const userId = req.user?.id;
    if (!userId) return reply.code(401).send({ error: 'Not authenticated' });

    const [listRes, countRes] = await Promise.all([
      app.db.query(
        'SELECT id, type, data, read_at, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30',
        [userId]
      ),
      app.db.query(
        'SELECT COUNT(*)::int as count FROM notifications WHERE user_id = $1 AND read_at IS NULL',
        [userId]
      ),
    ]);

    reply.send({
      notifications: listRes.rows.map(n => ({
        id: n.id,
        type: n.type,
        data: n.data,
        readAt: n.read_at,
        createdAt: n.created_at,
      })),
      unreadCount: countRes.rows[0]?.count || 0,
    });
  });

  // Lightweight unread count for polling
  app.get('/count', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const userId = req.user?.id;
    if (!userId) return reply.code(401).send({ error: 'Not authenticated' });

    const { rows: [{ count }] } = await app.db.query(
      'SELECT COUNT(*)::int as count FROM notifications WHERE user_id = $1 AND read_at IS NULL',
      [userId]
    );

    reply.send({ unreadCount: count });
  });

  // Mark notifications as read
  app.post('/read', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const userId = req.user?.id;
    if (!userId) return reply.code(401).send({ error: 'Not authenticated' });

    const { ids, all } = req.body || {};

    if (all) {
      await app.db.query(
        'UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL',
        [userId]
      );
    } else if (Array.isArray(ids) && ids.length > 0) {
      await app.db.query(
        'UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL AND id = ANY($2)',
        [userId, ids]
      );
    }

    reply.send({ ok: true });
  });
}
