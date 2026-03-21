import { adminGuard } from '../middleware/auth-guard.js';
import { notify } from '../services/notifications.js';
import { sendFeedbackRewardEmail } from '../services/email.js';

export default async function feedbackRoutes(app) {

  // ── User: submit feedback ──
  app.post('/', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'Non autenticato' });

    const { type, message, pageUrl } = req.body || {};
    if (!type || !message) return reply.code(400).send({ error: 'Tipo e messaggio richiesti' });
    if (!['bug', 'suggestion'].includes(type)) return reply.code(400).send({ error: 'Tipo non valido' });
    if (message.length > 2000) return reply.code(400).send({ error: 'Messaggio troppo lungo (max 2000 caratteri)' });

    const res = await app.db.query(
      `INSERT INTO feedback (user_id, type, message, page_url) VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.id, type, message.trim(), pageUrl || null]
    );

    return reply.send({ ok: true, feedback: res.rows[0] });
  });

  // ── User: list own feedback ──
  app.get('/mine', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'Non autenticato' });

    const res = await app.db.query(
      `SELECT id, type, message, page_url, status, credits_awarded, admin_note, created_at
       FROM feedback WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );

    return reply.send({ feedback: res.rows });
  });

  // ── Admin: list all feedback ──
  app.get('/admin', { preHandler: adminGuard }, async (req, reply) => {
    const { type, status, limit = 50 } = req.query;
    let query = `SELECT f.*, u.email as user_email, u.name as user_name
                 FROM feedback f JOIN users u ON f.user_id = u.id`;
    const conditions = [];
    const params = [];

    if (type) {
      params.push(type);
      conditions.push(`f.type = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`f.status = $${params.length}`);
    }

    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY f.created_at DESC';
    params.push(parseInt(limit));
    query += ` LIMIT $${params.length}`;

    const res = await app.db.query(query, params);
    return reply.send({ feedback: res.rows });
  });

  // ── Admin: reward feedback ──
  app.post('/admin/:id/reward', { preHandler: adminGuard }, async (req, reply) => {
    const { id } = req.params;
    const { credits, note } = req.body || {};

    if (!credits || credits < 1 || credits > 50) {
      return reply.code(400).send({ error: 'Crediti non validi (1-50)' });
    }

    const fb = await app.db.query('SELECT * FROM feedback WHERE id = $1', [id]);
    if (!fb.rows[0]) return reply.code(404).send({ error: 'Feedback non trovato' });

    const entry = fb.rows[0];

    // Add credits to user
    await app.db.query('UPDATE users SET credits = credits + $1 WHERE id = $2', [credits, entry.user_id]);

    // Update feedback status
    await app.db.query(
      `UPDATE feedback SET status = 'rewarded', credits_awarded = credits_awarded + $1, admin_note = $2 WHERE id = $3`,
      [credits, note || null, id]
    );

    // In-app notification
    notify(app.db, entry.user_id, 'feedback_rewarded', { credits, note: note || null }).catch(() => {});

    // Email notification
    const userRes = await app.db.query('SELECT email, name FROM users WHERE id = $1', [entry.user_id]);
    if (userRes.rows[0]?.email) {
      sendFeedbackRewardEmail(userRes.rows[0].email, userRes.rows[0].name, credits, note || null)
        .catch((err) => req.log.error({ err }, 'Failed to send feedback reward email'));
    }

    // Audit log
    app.db.query(
      'INSERT INTO audit_logs (user_id, action, ip, user_agent, metadata) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'admin_feedback_reward', req.ip, req.headers['user-agent']?.substring(0, 500) || null,
       JSON.stringify({ feedback_id: id, target_user: entry.user_id, credits })]
    ).catch(() => {});

    return reply.send({ ok: true });
  });

  // ── Admin: mark as reviewed (no reward) ──
  app.post('/admin/:id/review', { preHandler: adminGuard }, async (req, reply) => {
    const { id } = req.params;
    const { note } = req.body || {};

    await app.db.query(
      `UPDATE feedback SET status = 'reviewed', admin_note = $1 WHERE id = $2`,
      [note || null, id]
    );

    return reply.send({ ok: true });
  });
}
