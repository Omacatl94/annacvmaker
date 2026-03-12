import crypto from 'node:crypto';
import { config } from '../config.js';
import { sign } from '../services/jwt.js';
import { google, linkedin } from '../services/oauth.js';

const COOKIE_NAME = '__Host-jh_token';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_AGE_S = 7 * 24 * 3600;

function setAuthCookie(reply, user, guest = false) {
  const token = sign({ id: user.id, guest, role: user.role || 'user' }, config.jwtSecret, MAX_AGE_S);
  reply.setCookie(COOKIE_NAME, token, {
    path: '/',
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    maxAge: MAX_AGE_MS / 1000,
  });
}

function clearAuthCookie(reply) {
  reply.clearCookie(COOKIE_NAME, { path: '/' });
}

export default async function authRoutes(app) {
  const STATE_COOKIE = 'jh_oauth_state';
  const STATE_MAX_AGE = 600; // 10 minutes

  function setStateCookie(reply, state) {
    reply.setCookie(STATE_COOKIE, state, {
      path: '/api/auth',
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: 'lax',
      maxAge: STATE_MAX_AGE,
    });
  }

  function verifyState(req) {
    const cookieState = req.cookies?.[STATE_COOKIE];
    const queryState = req.query?.state;
    if (!cookieState || !queryState || cookieState !== queryState) {
      throw new Error('OAuth state mismatch');
    }
  }

  async function auditLog(req, userId, action, metadata = null) {
    app.db.query(
      'INSERT INTO audit_logs (user_id, action, ip, user_agent, metadata) VALUES ($1, $2, $3, $4, $5)',
      [userId, action, req.ip, req.headers['user-agent']?.substring(0, 500) || null, metadata ? JSON.stringify(metadata) : null]
    ).catch(() => {});
  }

  async function findOrCreateUser({ email, name, googleId, linkedinId }) {
    if (googleId) {
      const found = await app.db.query('SELECT * FROM users WHERE google_id = $1', [googleId]);
      if (found.rows[0]) return { user: found.rows[0], isNew: false };
    }
    if (linkedinId) {
      const found = await app.db.query('SELECT * FROM users WHERE linkedin_id = $1', [linkedinId]);
      if (found.rows[0]) return { user: found.rows[0], isNew: false };
    }
    const byEmail = await app.db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (byEmail.rows[0]) {
      const user = byEmail.rows[0];
      if (googleId && !user.google_id) {
        await app.db.query('UPDATE users SET google_id = $1 WHERE id = $2', [googleId, user.id]);
      }
      if (linkedinId && !user.linkedin_id) {
        await app.db.query('UPDATE users SET linkedin_id = $1 WHERE id = $2', [linkedinId, user.id]);
      }
      return { user, isNew: false };
    }
    const referralCode = crypto.randomBytes(3).toString('hex').toUpperCase();
    const result = await app.db.query(
      'INSERT INTO users (email, name, google_id, linkedin_id, referral_code) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [email, name, googleId || null, linkedinId || null, referralCode]
    );
    return { user: result.rows[0], isNew: true };
  }

  app.get('/google', (req, reply) => {
    const state = crypto.randomBytes(32).toString('hex');
    setStateCookie(reply, state);
    reply.redirect(google.getAuthUrl(state));
  });

  app.get('/google/callback', async (req, reply) => {
    try {
      verifyState(req);
      reply.clearCookie(STATE_COOKIE, { path: '/api/auth' });
      const { code } = req.query;
      if (!code) throw new Error('No code received');
      const tokens = await google.getToken(code);
      const info = await google.getUserInfo(tokens.access_token);
      const { user, isNew } = await findOrCreateUser({ email: info.email, name: info.name, googleId: info.id });
      auditLog(req, user.id, isNew ? 'register_google' : 'login_google');
      setAuthCookie(reply, user, false);
      return reply.redirect('/');
    } catch (err) {
      req.log.error(err);
      return reply.redirect('/?error=auth_failed');
    }
  });

  app.get('/linkedin', (req, reply) => {
    const state = crypto.randomBytes(32).toString('hex');
    setStateCookie(reply, state);
    reply.redirect(linkedin.getAuthUrl(state));
  });

  app.get('/linkedin/callback', async (req, reply) => {
    try {
      verifyState(req);
      reply.clearCookie(STATE_COOKIE, { path: '/api/auth' });
      const { code } = req.query;
      if (!code) throw new Error('No code received');
      const tokens = await linkedin.getToken(code);
      const info = await linkedin.getUserInfo(tokens.access_token);
      const { user, isNew } = await findOrCreateUser({ email: info.email, name: info.name, linkedinId: info.sub });
      auditLog(req, user.id, isNew ? 'register_linkedin' : 'login_linkedin');
      setAuthCookie(reply, user, false);
      return reply.redirect('/');
    } catch (err) {
      req.log.error(err);
      return reply.redirect('/?error=auth_failed');
    }
  });

  // Dev-only login (bypasses OAuth for local testing)
  app.post('/dev-login', async (req, reply) => {
    if (process.env.NODE_ENV === 'production') return reply.code(404).send({ error: 'Not found' });
    const { email, name } = req.body || {};
    if (!email) return reply.code(400).send({ error: 'email required' });
    const { user } = await findOrCreateUser({ email, name: name || 'Test User' });
    setAuthCookie(reply, user, false);
    reply.send({ user: { id: user.id, email: user.email, name: user.name } });
  });

  app.post('/guest', async (req, reply) => {
    const guestId = crypto.randomUUID();
    const guestEmail = `guest-${guestId.slice(0, 8)}@anonymous`;
    const result = await app.db.query(
      'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING *',
      [guestEmail, 'Ospite']
    );
    const user = result.rows[0];
    auditLog(req, user.id, 'login_guest');
    setAuthCookie(reply, user, true);
    return reply.send({ user: { id: user.id, name: user.name, email: null, guest: true } });
  });

  app.get('/me', async (req, reply) => {
    if (!req.user?.id) return reply.send({ user: null });
    const result = await app.db.query(
      `SELECT u.id, u.email, u.name, u.phone, u.location, u.preferences,
              u.role, u.google_id, u.linkedin_id, u.created_at,
              (SELECT cp.photo_path FROM cv_profiles cp WHERE cp.user_id = u.id ORDER BY cp.updated_at DESC LIMIT 1) AS photo_path
       FROM users u WHERE u.id = $1`,
      [req.user.id]
    );
    const user = result.rows[0];
    if (!user) return reply.send({ user: null });
    const isGuest = !!req.user.guest || user.email.endsWith('@anonymous');
    reply.send({
      user: {
        id: user.id, email: isGuest ? null : user.email, name: user.name,
        phone: user.phone, location: user.location,
        photo_path: user.photo_path || null,
        preferences: user.preferences || {},
        googleLinked: !!user.google_id, linkedinLinked: !!user.linkedin_id,
        createdAt: user.created_at,
        guest: isGuest,
        role: user.role || 'user',
      },
    });
  });

  app.put('/me', async (req, reply) => {
    if (!req.user?.id) return reply.code(401).send({ error: 'Not authenticated' });
    const { name, phone, location, preferences } = req.body;
    const result = await app.db.query(
      `UPDATE users
       SET name = COALESCE($1, name),
           phone = COALESCE($2, phone),
           location = COALESCE($3, location),
           preferences = COALESCE($4, preferences),
           updated_at = NOW()
       WHERE id = $5 RETURNING id, email, name, phone, location, preferences`,
      [name, phone, location, preferences ? JSON.stringify(preferences) : null, req.user.id]
    );
    reply.send({ user: result.rows[0] });
  });

  // GDPR data export
  app.get('/me/export', async (req, reply) => {
    if (!req.user?.id) return reply.code(401).send({ error: 'Not authenticated' });
    const uid = req.user.id;

    const [userRes, profilesRes, generatedRes] = await Promise.all([
      app.db.query('SELECT id, email, name, phone, location, preferences, created_at, updated_at FROM users WHERE id = $1', [uid]),
      app.db.query('SELECT id, label, personal, experiences, education, skills, languages, created_at, updated_at FROM cv_profiles WHERE user_id = $1', [uid]),
      app.db.query(
        `SELECT g.id, g.job_description, g.target_role, g.target_company, g.language, g.style, g.generated_data, g.ats_classic, g.ats_smart, g.status, g.notes, g.created_at
         FROM generated_cvs g JOIN cv_profiles p ON g.profile_id = p.id
         WHERE p.user_id = $1 ORDER BY g.created_at DESC`, [uid]
      ),
    ]);

    reply
      .header('Content-Type', 'application/json')
      .header('Content-Disposition', 'attachment; filename="jobhacker-data-export.json"')
      .send({
        exportDate: new Date().toISOString(),
        user: userRes.rows[0] || null,
        profiles: profilesRes.rows,
        generatedCVs: generatedRes.rows,
      });
  });

  app.delete('/me', async (req, reply) => {
    if (!req.user?.id) return reply.code(401).send({ error: 'Not authenticated' });
    await app.db.query('DELETE FROM users WHERE id = $1', [req.user.id]);
    clearAuthCookie(reply);
    reply.send({ ok: true });
  });

  app.post('/logout', async (req, reply) => {
    auditLog(req, req.user?.id, 'logout');
    clearAuthCookie(reply);
    reply.send({ ok: true });
  });

  // ── Referral system ──

  app.post('/referral-claim', async (req, reply) => {
    const userId = req.user?.id;
    if (!userId) return reply.code(401).send({ error: 'Not authenticated' });

    const { code } = req.body;
    if (!code) return reply.code(400).send({ error: 'code required' });

    const referrer = await app.db.query('SELECT id FROM users WHERE referral_code = $1', [code]);
    if (!referrer.rows[0]) return reply.code(404).send({ error: 'Codice non valido' });
    const referrerId = referrer.rows[0].id;
    if (referrerId === userId) return reply.code(400).send({ error: 'Non puoi usare il tuo codice' });

    const existing = await app.db.query('SELECT id FROM referrals WHERE referred_id = $1', [userId]);
    if (existing.rows[0]) return reply.code(409).send({ error: 'Hai già usato un codice referral' });

    const count = await app.db.query('SELECT COUNT(*) as cnt FROM referrals WHERE referrer_id = $1', [referrerId]);
    if (parseInt(count.rows[0].cnt) >= 20) return reply.code(400).send({ error: 'Il referrer ha raggiunto il limite' });

    await app.db.query('UPDATE users SET credits = credits + 2 WHERE id = $1', [referrerId]);
    await app.db.query(
      'INSERT INTO referrals (referrer_id, referred_id, credits_awarded) VALUES ($1, $2, 2)',
      [referrerId, userId]
    );

    reply.send({ ok: true });
  });

  app.get('/referral-stats', async (req, reply) => {
    const userId = req.user?.id;
    if (!userId) return reply.code(401).send({ error: 'Not authenticated' });

    const user = await app.db.query('SELECT referral_code FROM users WHERE id = $1', [userId]);
    const stats = await app.db.query(
      'SELECT COUNT(*) as total, COALESCE(SUM(credits_awarded), 0) as credits FROM referrals WHERE referrer_id = $1',
      [userId]
    );

    reply.send({
      code: user.rows[0]?.referral_code || null,
      referrals: parseInt(stats.rows[0]?.total || 0),
      creditsEarned: parseInt(stats.rows[0]?.credits || 0),
      maxReferrals: 20,
    });
  });
}
