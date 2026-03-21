import crypto from 'node:crypto';
import { config } from '../config.js';
import { sign } from '../services/jwt.js';
import { google, linkedin } from '../services/oauth.js';
import { notifyAdminNewWaitlist } from '../services/email.js';

const COOKIE_NAME = config.cookieSecure ? '__Host-jh_token' : 'jh_token';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_AGE_S = 7 * 24 * 3600;

function setAuthCookie(reply, user, guest = false) {
  const token = sign(
    { id: user.id, guest, role: user.role || 'user', status: user.status || 'active' },
    config.jwtSecret,
    MAX_AGE_S
  );
  reply.setCookie(COOKIE_NAME, token, {
    path: '/',
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    maxAge: MAX_AGE_MS / 1000,
  });
}

function clearAuthCookie(reply) {
  reply.clearCookie(COOKIE_NAME, {
    path: '/',
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
  });
}

export default async function authRoutes(app) {
  // Dev-only: login as admin without OAuth
  if (!config.cookieSecure) {
    app.get('/dev-login', async (req, reply) => {
      const email = config.adminEmails[0];
      if (!email) return reply.code(500).send({ error: 'No admin email configured' });
      let user = (await app.db.query('SELECT * FROM users WHERE LOWER(email) = $1', [email.toLowerCase()])).rows[0];
      if (!user) {
        user = (await app.db.query(
          "INSERT INTO users (name, email, role, status) VALUES ('Admin Dev', $1, 'admin', 'active') RETURNING *",
          [email]
        )).rows[0];
      }
      setAuthCookie(reply, user);
      reply.redirect('/');
    });
  }

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

    // New user → waitlist, admin activates manually
    const normalized = email.toLowerCase();
    const wlResult = await app.db.query(
      `INSERT INTO waitlist (email, name, google_id, linkedin_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET
         name = COALESCE(EXCLUDED.name, waitlist.name),
         google_id = COALESCE(EXCLUDED.google_id, waitlist.google_id),
         linkedin_id = COALESCE(EXCLUDED.linkedin_id, waitlist.linkedin_id)
       RETURNING (xmax = 0) AS is_new`,
      [normalized, name || null, googleId || null, linkedinId || null]
    );

    // Notify admin only for genuinely new waitlist entries (not upsert updates)
    if (wlResult.rows[0]?.is_new) {
      const source = googleId ? 'oauth_google' : linkedinId ? 'oauth_linkedin' : 'form';
      notifyAdminNewWaitlist(normalized, name, source).catch(() => {});
    }

    return { user: null, isNew: true, waitlisted: true };
  }

  app.get('/google', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, (req, reply) => {
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
      const { user, isNew, waitlisted } = await findOrCreateUser({ email: info.email, name: info.name, googleId: info.id });
      if (waitlisted) {
        auditLog(req, null, 'waitlist_google', { email: info.email });
        return reply.redirect('/?waitlisted=1');
      }
      auditLog(req, user.id, isNew ? 'register_google' : 'login_google');
      setAuthCookie(reply, user, false);
      return reply.redirect('/');
    } catch (err) {
      req.log.error(err);
      auditLog(req, null, 'oauth_failed', { provider: 'google', error: err.message?.substring(0, 200) });
      return reply.redirect('/?error=auth_failed');
    }
  });

  app.get('/linkedin', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, (req, reply) => {
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
      const { user, isNew, waitlisted } = await findOrCreateUser({ email: info.email, name: info.name, linkedinId: info.sub });
      if (waitlisted) {
        auditLog(req, null, 'waitlist_linkedin', { email: info.email });
        return reply.redirect('/?waitlisted=1');
      }
      auditLog(req, user.id, isNew ? 'register_linkedin' : 'login_linkedin');
      setAuthCookie(reply, user, false);
      return reply.redirect('/');
    } catch (err) {
      req.log.error(err);
      auditLog(req, null, 'oauth_failed', { provider: 'linkedin', error: err.message?.substring(0, 200) });
      return reply.redirect('/?error=auth_failed');
    }
  });

  // Dev-only login (bypasses OAuth for local testing)
  if (process.env.NODE_ENV === 'development') {
    app.post('/dev-login', async (req, reply) => {
      const { email, name } = req.body || {};
      if (!email) return reply.code(400).send({ error: 'email required' });
      const { user } = await findOrCreateUser({ email, name: name || 'Test User' });
      setAuthCookie(reply, user, false);
      reply.send({ user: { id: user.id, email: user.email, name: user.name } });
    });
  }

  app.post('/guest', {
    config: { rateLimit: { max: 3, timeWindow: '1 minute' } },
  }, async (req, reply) => {
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
              u.role, u.status, u.google_id, u.linkedin_id, u.created_at,
              (SELECT cp.photo_path FROM cv_profiles cp WHERE cp.user_id = u.id ORDER BY cp.updated_at DESC LIMIT 1) AS photo_path
       FROM users u WHERE u.id = $1`,
      [req.user.id]
    );
    const user = result.rows[0];
    if (!user) return reply.send({ user: null });
    const isGuest = !!req.user.guest || user.email.endsWith('@anonymous');

    // Re-issue JWT if status or role changed in DB (e.g. admin activated user)
    const dbStatus = user.status || 'active';
    const dbRole = user.role || 'user';
    if (dbStatus !== req.user.status || dbRole !== req.user.role) {
      setAuthCookie(reply, { ...user, status: dbStatus, role: dbRole }, isGuest);
    }

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
        status: user.status || 'active',
      },
    });
  });

  app.put('/me', {
    schema: {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', maxLength: 200 },
          phone: { type: 'string', maxLength: 30 },
          location: { type: 'string', maxLength: 200 },
          preferences: { type: 'object', maxProperties: 50 },
        },
      },
    },
  }, async (req, reply) => {
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
    auditLog(req, req.user.id, 'gdpr_export');
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
    auditLog(req, req.user.id, 'account_delete');
    await app.db.query('DELETE FROM users WHERE id = $1', [req.user.id]);
    clearAuthCookie(reply);
    reply.send({ ok: true });
  });

  app.post('/logout', async (req, reply) => {
    auditLog(req, req.user?.id, 'logout');
    clearAuthCookie(reply);
    reply.send({ ok: true });
  });

  // Check if an email belongs to an active account (used by login modal)
  app.post('/check-email', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    schema: {
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email', maxLength: 255 },
        },
      },
    },
  }, async (req, reply) => {
    const normalized = req.body.email.toLowerCase().trim();
    const existing = await app.db.query(
      "SELECT id, status, google_id, linkedin_id FROM users WHERE LOWER(email) = $1 AND email NOT LIKE '%@anonymous'",
      [normalized]
    );
    const user = existing.rows[0];
    if (!user) {
      // Auto-add to waitlist
      const wlResult = await app.db.query(
        'INSERT INTO waitlist (email) VALUES ($1) ON CONFLICT (email) DO NOTHING RETURNING id',
        [normalized]
      );
      const isNew = wlResult.rowCount > 0;
      if (isNew) {
        notifyAdminNewWaitlist(normalized, null, 'login_check').catch(() => {});
      }
      return reply.send({ exists: false, addedToWaitlist: true, alreadyInWaitlist: !isNew });
    }
    return reply.send({
      exists: true,
      active: user.status === 'active',
      providers: {
        google: !!user.google_id,
        linkedin: !!user.linkedin_id,
      },
    });
  });

  app.post('/waitlist', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    schema: {
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email', maxLength: 255 },
        },
      },
    },
  }, async (req, reply) => {
    const { email } = req.body;
    const normalized = email.toLowerCase().trim();

    // Check if already an active user
    const existing = await app.db.query(
      "SELECT id, status FROM users WHERE LOWER(email) = $1 AND email NOT LIKE '%@anonymous'",
      [normalized]
    );
    if (existing.rows[0]?.status === 'active') {
      return reply.send({ ok: true, alreadyActive: true });
    }

    try {
      const wlResult = await app.db.query(
        'INSERT INTO waitlist (email) VALUES ($1) ON CONFLICT (email) DO NOTHING RETURNING id',
        [normalized]
      );
      // Notify admin only if actually inserted (not a duplicate)
      if (wlResult.rowCount > 0) {
        notifyAdminNewWaitlist(normalized, null, 'form').catch(() => {});
      }
    } catch { /* ignore */ }
    reply.send({ ok: true });
  });
}
