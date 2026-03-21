import { adminGuard } from '../middleware/auth-guard.js';
import { openrouter } from '../services/openrouter.js';
import { sendWelcomeEmail, sendRaccoinGiftEmail } from '../services/email.js';
import { notify } from '../services/notifications.js';

const WELCOME_CREDITS = 2;

export default async function adminRoutes(app) {
  app.addHook('preHandler', adminGuard);

  // ── Overview KPIs ──
  app.get('/stats/overview', async (req, reply) => {
    const [users, users7d, users30d, revenue, revenue30d, cvs, cvs30d, coverLetters, creditsUsed] = await Promise.all([
      app.db.query(`SELECT COUNT(*) as n FROM users WHERE email NOT LIKE '%@anonymous'`),
      app.db.query(`SELECT COUNT(*) as n FROM users WHERE email NOT LIKE '%@anonymous' AND created_at > NOW() - INTERVAL '7 days'`),
      app.db.query(`SELECT COUNT(*) as n FROM users WHERE email NOT LIKE '%@anonymous' AND created_at > NOW() - INTERVAL '30 days'`),
      app.db.query(`SELECT COALESCE(SUM(amount_cents), 0) as total FROM purchases`),
      app.db.query(`SELECT COALESCE(SUM(amount_cents), 0) as total FROM purchases WHERE created_at > NOW() - INTERVAL '30 days'`),
      app.db.query(`SELECT COUNT(*) as n FROM generated_cvs`),
      app.db.query(`SELECT COUNT(*) as n FROM generated_cvs WHERE created_at > NOW() - INTERVAL '30 days'`),
      app.db.query(`SELECT COUNT(*) as n FROM credit_usage WHERE action = 'cover_letter'`),
      app.db.query(`SELECT COALESCE(SUM(credits_consumed), 0) as n FROM credit_usage`),
    ]);

    reply.send({
      users: { total: +users.rows[0].n, last7d: +users7d.rows[0].n, last30d: +users30d.rows[0].n },
      revenue: { totalCents: +revenue.rows[0].total, last30dCents: +revenue30d.rows[0].total },
      cvs: { total: +cvs.rows[0].n, last30d: +cvs30d.rows[0].n },
      coverLetters: +coverLetters.rows[0].n,
      creditsUsed: +creditsUsed.rows[0].n,
    });
  });

  // ── Timeseries ──
  app.get('/stats/timeseries', async (req, reply) => {
    const { metric, from, to } = req.query;
    const params = [from || '2026-01-01', to || new Date().toISOString().slice(0, 10)];

    const queries = {
      registrations: `SELECT DATE(created_at) as date, COUNT(*) as value FROM users WHERE email NOT LIKE '%@anonymous' AND created_at >= $1 AND created_at <= $2::date + 1 GROUP BY DATE(created_at) ORDER BY date`,
      revenue: `SELECT DATE(created_at) as date, SUM(amount_cents) as value FROM purchases WHERE created_at >= $1 AND created_at <= $2::date + 1 GROUP BY DATE(created_at) ORDER BY date`,
      cv_generated: `SELECT DATE(created_at) as date, COUNT(*) as value FROM generated_cvs WHERE created_at >= $1 AND created_at <= $2::date + 1 GROUP BY DATE(created_at) ORDER BY date`,
      credit_usage: `SELECT DATE(created_at) as date, SUM(credits_consumed) as value FROM credit_usage WHERE created_at >= $1 AND created_at <= $2::date + 1 GROUP BY DATE(created_at) ORDER BY date`,
      purchases: `SELECT DATE(created_at) as date, COUNT(*) as value FROM purchases WHERE created_at >= $1 AND created_at <= $2::date + 1 GROUP BY DATE(created_at) ORDER BY date`,
    };

    if (!queries[metric]) return reply.code(400).send({ error: 'Invalid metric' });

    const { rows } = await app.db.query(queries[metric], params);
    reply.send({ metric, data: rows.map(r => ({ date: r.date.toISOString().slice(0, 10), value: +r.value })) });
  });

  // ── Cohort (retention/churn) ──
  app.get('/stats/cohort', async (req, reply) => {
    const { rows } = await app.db.query(`
      WITH cohorts AS (
        SELECT id, DATE_TRUNC('month', created_at) as cohort_month
        FROM users WHERE email NOT LIKE '%@anonymous'
      ),
      activity AS (
        SELECT user_id, DATE_TRUNC('month', created_at) as active_month
        FROM credit_usage
        GROUP BY user_id, DATE_TRUNC('month', created_at)
      )
      SELECT
        TO_CHAR(c.cohort_month, 'YYYY-MM') as cohort,
        COUNT(DISTINCT c.id) as cohort_size,
        TO_CHAR(a.active_month, 'YYYY-MM') as active_month,
        COUNT(DISTINCT a.user_id) as active_users
      FROM cohorts c
      LEFT JOIN activity a ON c.id = a.user_id
      GROUP BY c.cohort_month, a.active_month
      ORDER BY c.cohort_month, a.active_month
    `);

    const cohorts = {};
    for (const r of rows) {
      if (!cohorts[r.cohort]) cohorts[r.cohort] = { size: +r.cohort_size, months: {} };
      if (r.active_month) cohorts[r.cohort].months[r.active_month] = +r.active_users;
    }
    reply.send({ cohorts });
  });

  // ── OpenRouter balance ──
  app.get('/stats/openrouter', async (req, reply) => {
    try {
      const balance = await openrouter.getBalance();
      reply.send(balance);
    } catch (err) {
      reply.code(502).send({ error: 'Failed to fetch OpenRouter balance', detail: err.message });
    }
  });

  // ── Users list ──
  app.get('/users', async (req, reply) => {
    const { search, sort, order, limit, offset } = req.query;
    const lim = Math.min(parseInt(limit) || 25, 100);
    const off = parseInt(offset) || 0;
    const SORT_COLUMNS = {
      created_at: 'u.created_at',
      email: 'u.email',
      name: 'u.name',
      credits: 'u.credits',
    };
    const sortExpr = SORT_COLUMNS[sort] || 'u.created_at';
    const sortDir = order === 'asc' ? 'ASC' : 'DESC';

    let where = `WHERE u.email NOT LIKE '%@anonymous' AND u.status != 'waitlist'`;
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (u.email ILIKE $${params.length} OR u.name ILIKE $${params.length})`;
    }

    params.push(lim, off);

    const { rows } = await app.db.query(`
      SELECT u.id, u.email, u.name, u.role, u.status, u.credits, u.created_at,
        (u.google_id IS NOT NULL) as google_linked,
        (u.linkedin_id IS NOT NULL) as linkedin_linked,
        (SELECT COUNT(*) FROM generated_cvs g JOIN cv_profiles cp ON g.profile_id = cp.id WHERE cp.user_id = u.id) as cvs_generated,
        (SELECT COALESCE(SUM(amount_cents), 0) FROM purchases p WHERE p.user_id = u.id) as total_spent_cents,
        (SELECT MAX(created_at) FROM audit_logs al WHERE al.user_id = u.id AND al.action LIKE 'login_%') as last_login,
        (SELECT COALESCE(SUM(credits_consumed), 0) FROM credit_usage WHERE user_id = u.id AND created_at >= CURRENT_DATE) as daily_used
      FROM users u ${where}
      ORDER BY ${sortExpr} ${sortDir}
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    const countRes = await app.db.query(`SELECT COUNT(*) as n FROM users u ${where}`, search ? [`%${search}%`] : []);

    reply.send({ users: rows, total: +countRes.rows[0].n });
  });

  // ── User detail ──
  app.get('/users/:id', async (req, reply) => {
    const { id } = req.params;
    const [userRes, purchasesRes, usageRes] = await Promise.all([
      app.db.query('SELECT id, email, name, role, credits, credits_expiry, phone, location, created_at FROM users WHERE id = $1', [id]),
      app.db.query('SELECT tier, credits_added, amount_cents, created_at FROM purchases WHERE user_id = $1 ORDER BY created_at DESC', [id]),
      app.db.query('SELECT action, credits_consumed, created_at FROM credit_usage WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50', [id]),
    ]);

    if (!userRes.rows[0]) return reply.code(404).send({ error: 'User not found' });

    reply.send({
      user: userRes.rows[0],
      purchases: purchasesRes.rows,
      usage: usageRes.rows,
    });
  });

  // ── Update user credits ──
  app.put('/users/:id/credits', async (req, reply) => {
    const { id } = req.params;
    const { credits, reason } = req.body;
    if (typeof credits !== 'number') return reply.code(400).send({ error: 'credits (number) required' });

    // Get old credits to calculate diff
    const oldRes = await app.db.query('SELECT credits FROM users WHERE id = $1', [id]);
    const oldCredits = oldRes.rows[0]?.credits || 0;
    const diff = credits - oldCredits;

    await app.db.query('UPDATE users SET credits = $1 WHERE id = $2', [credits, id]);

    if (diff > 0) {
      notify(app.db, id, 'credits_received', { credits: diff, reason: reason || null }).catch(() => {});

      // Email notification
      const userRes = await app.db.query('SELECT email, name FROM users WHERE id = $1', [id]);
      if (userRes.rows[0]?.email) {
        sendRaccoinGiftEmail(userRes.rows[0].email, userRes.rows[0].name, diff, reason || null)
          .catch((err) => req.log.error({ err }, 'Failed to send raccoin gift email'));
      }
    }

    // Log in credit_usage
    await app.db.query(
      `INSERT INTO credit_usage (user_id, action, credits_consumed) VALUES ($1, 'admin_adjustment', $2)`,
      [id, 0]
    );

    // Audit log
    await app.db.query(
      `INSERT INTO audit_logs (user_id, action, ip, user_agent, metadata) VALUES ($1, 'admin_credit_change', $2, $3, $4)`,
      [req.user.id, req.ip, req.headers['user-agent']?.substring(0, 500) || null, JSON.stringify({ targetUser: id, newCredits: credits, reason: reason || '' })]
    );

    reply.send({ ok: true, credits });
  });

  // ── Activate waitlist user ──
  app.put('/users/:id/activate', async (req, reply) => {
    const { id } = req.params;

    const userRes = await app.db.query('SELECT id, email, name, status FROM users WHERE id = $1', [id]);
    const user = userRes.rows[0];
    if (!user) return reply.code(404).send({ error: 'User not found' });
    if (user.status === 'active') return reply.code(400).send({ error: 'User already active' });

    // Activate + welcome credits
    await app.db.query(
      'UPDATE users SET status = $1, credits = credits + $2 WHERE id = $3',
      ['active', WELCOME_CREDITS, id]
    );

    // Audit
    await app.db.query(
      `INSERT INTO audit_logs (user_id, action, ip, user_agent, metadata)
       VALUES ($1, 'admin_activate_user', $2, $3, $4)`,
      [req.user.id, req.ip, req.headers['user-agent']?.substring(0, 500) || null,
       JSON.stringify({ targetUser: id, credits: WELCOME_CREDITS })]
    );

    // Notification
    notify(app.db, id, 'welcome_activated', { credits: WELCOME_CREDITS }).catch(() => {});

    // Welcome email (fire-and-forget)
    sendWelcomeEmail(user.email, user.name).catch(err => {
      req.log.error({ err, userId: id }, 'Failed to send welcome email');
    });

    reply.send({ ok: true });
  });

  // ── Audit logs ──
  app.get('/audit', async (req, reply) => {
    const { user_id, action, from, to, limit, offset } = req.query;
    const lim = Math.min(parseInt(limit) || 50, 200);
    const off = parseInt(offset) || 0;

    let where = 'WHERE 1=1';
    const params = [];
    if (user_id) { params.push(user_id); where += ` AND a.user_id = $${params.length}`; }
    if (action) { params.push(action); where += ` AND a.action = $${params.length}`; }
    if (from) { params.push(from); where += ` AND a.created_at >= $${params.length}`; }
    if (to) { params.push(to); where += ` AND a.created_at <= $${params.length}::date + 1`; }

    params.push(lim, off);

    const { rows } = await app.db.query(`
      SELECT a.*, u.email as user_email, u.name as user_name
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ${where}
      ORDER BY a.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    reply.send({ logs: rows });
  });

  // ── Error logs ──
  app.get('/errors', async (req, reply) => {
    const { level, search, from, to, limit, offset } = req.query;
    const lim = Math.min(parseInt(limit) || 50, 200);
    const off = parseInt(offset) || 0;

    let where = 'WHERE 1=1';
    const params = [];
    if (level) { params.push(level); where += ` AND e.level = $${params.length}`; }
    if (search) { params.push(`%${search}%`); where += ` AND (e.message ILIKE $${params.length} OR e.endpoint ILIKE $${params.length})`; }
    if (from) { params.push(from); where += ` AND e.created_at >= $${params.length}`; }
    if (to) { params.push(to); where += ` AND e.created_at <= $${params.length}::date + 1`; }

    params.push(lim, off);

    const { rows } = await app.db.query(`
      SELECT e.*, u.email as user_email
      FROM error_logs e
      LEFT JOIN users u ON e.user_id = u.id
      ${where}
      ORDER BY e.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    reply.send({ errors: rows });
  });

  // ── Waitlist management ──
  app.get('/waitlist', async (req, reply) => {
    const { search, limit, offset } = req.query;
    const lim = Math.min(parseInt(limit) || 50, 200);
    const off = parseInt(offset) || 0;

    let where = 'WHERE 1=1';
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      where += ` AND w.email ILIKE $${params.length}`;
    }

    params.push(lim, off);

    const { rows } = await app.db.query(`
      SELECT w.*, (w.invited_at IS NOT NULL) as invited
      FROM waitlist w ${where}
      ORDER BY w.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    const countRes = await app.db.query(
      `SELECT COUNT(*) as n FROM waitlist w ${where}`,
      search ? [`%${search}%`] : []
    );

    reply.send({ waitlist: rows, total: +countRes.rows[0].n });
  });

  // ── Activate waitlist entry: create user directly ──
  app.post('/waitlist/:id/activate', async (req, reply) => {
    const { id } = req.params;

    const wl = await app.db.query('SELECT * FROM waitlist WHERE id = $1', [id]);
    if (!wl.rows[0]) return reply.code(404).send({ error: 'Waitlist entry not found' });
    const entry = wl.rows[0];

    // Check if user already exists (e.g. they registered via another path)
    const existing = await app.db.query('SELECT id FROM users WHERE LOWER(email) = $1', [entry.email.toLowerCase()]);
    if (existing.rows[0]) {
      // Just activate the existing user
      await app.db.query('UPDATE users SET status = $1, credits = credits + $2 WHERE id = $3', ['active', WELCOME_CREDITS, existing.rows[0].id]);
      await app.db.query('DELETE FROM waitlist WHERE id = $1', [id]);
      notify(app.db, existing.rows[0].id, 'welcome_activated', { credits: WELCOME_CREDITS }).catch(() => {});
      sendWelcomeEmail(entry.email, entry.name).catch(err => {
        req.log.error({ err, email: entry.email }, 'Failed to send welcome email');
      });
      return reply.send({ ok: true, userId: existing.rows[0].id });
    }

    // Create new user from waitlist data
    const referralCode = (await import('node:crypto')).default.randomBytes(3).toString('hex').toUpperCase();
    const userRes = await app.db.query(
      `INSERT INTO users (email, name, google_id, linkedin_id, referral_code, status, credits)
       VALUES ($1, $2, $3, $4, $5, 'active', $6) RETURNING *`,
      [entry.email, entry.name || null, entry.google_id || null, entry.linkedin_id || null, referralCode, WELCOME_CREDITS]
    );
    const user = userRes.rows[0];

    // Remove from waitlist
    await app.db.query('DELETE FROM waitlist WHERE id = $1', [id]);

    // Audit
    await app.db.query(
      `INSERT INTO audit_logs (user_id, action, ip, user_agent, metadata)
       VALUES ($1, 'admin_activate_waitlist', $2, $3, $4)`,
      [req.user.id, req.ip, req.headers['user-agent']?.substring(0, 500) || null,
       JSON.stringify({ waitlistId: id, email: entry.email, newUserId: user.id })]
    );

    // Notification
    notify(app.db, user.id, 'welcome_activated', { credits: WELCOME_CREDITS }).catch(() => {});

    // Welcome email
    sendWelcomeEmail(entry.email, entry.name).catch(err => {
      req.log.error({ err, email: entry.email }, 'Failed to send welcome email');
    });

    reply.send({ ok: true, userId: user.id });
  });

  // ── Delete waitlist entry ──
  app.delete('/waitlist/:id', async (req, reply) => {
    const { id } = req.params;
    const result = await app.db.query('DELETE FROM waitlist WHERE id = $1 RETURNING email', [id]);
    if (result.rowCount === 0) return reply.code(404).send({ error: 'Waitlist entry not found' });

    await app.db.query(
      `INSERT INTO audit_logs (user_id, action, ip, user_agent, metadata)
       VALUES ($1, 'admin_delete_waitlist', $2, $3, $4)`,
      [req.user.id, req.ip, req.headers['user-agent']?.substring(0, 500) || null,
       JSON.stringify({ waitlistId: id, email: result.rows[0].email })]
    );

    reply.send({ ok: true });
  });

}
