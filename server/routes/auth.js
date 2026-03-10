import { google, linkedin } from '../services/oauth.js';

export default async function authRoutes(app) {
  async function findOrCreateUser({ email, name, googleId, linkedinId }) {
    if (googleId) {
      const found = await app.db.query('SELECT * FROM users WHERE google_id = $1', [googleId]);
      if (found.rows[0]) return found.rows[0];
    }
    if (linkedinId) {
      const found = await app.db.query('SELECT * FROM users WHERE linkedin_id = $1', [linkedinId]);
      if (found.rows[0]) return found.rows[0];
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
      return user;
    }
    const result = await app.db.query(
      'INSERT INTO users (email, name, google_id, linkedin_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [email, name, googleId || null, linkedinId || null]
    );
    return result.rows[0];
  }

  app.get('/google', (req, reply) => {
    reply.redirect(google.getAuthUrl());
  });

  app.get('/google/callback', async (req, reply) => {
    try {
      const { code } = req.query;
      if (!code) throw new Error('No code received');
      const tokens = await google.getToken(code);
      const info = await google.getUserInfo(tokens.access_token);
      const user = await findOrCreateUser({ email: info.email, name: info.name, googleId: info.id });
      req.session.userId = user.id;
      reply.redirect('/');
    } catch (err) {
      req.log.error(err);
      reply.redirect('/?error=auth_failed');
    }
  });

  app.get('/linkedin', (req, reply) => {
    reply.redirect(linkedin.getAuthUrl());
  });

  app.get('/linkedin/callback', async (req, reply) => {
    try {
      const { code } = req.query;
      if (!code) throw new Error('No code received');
      const tokens = await linkedin.getToken(code);
      const info = await linkedin.getUserInfo(tokens.access_token);
      const user = await findOrCreateUser({ email: info.email, name: info.name, linkedinId: info.sub });
      req.session.userId = user.id;
      reply.redirect('/');
    } catch (err) {
      req.log.error(err);
      reply.redirect('/?error=auth_failed');
    }
  });

  app.get('/me', async (req, reply) => {
    if (!req.session.userId) return reply.send({ user: null });
    const result = await app.db.query('SELECT id, email, name FROM users WHERE id = $1', [req.session.userId]);
    reply.send({ user: result.rows[0] || null });
  });

  app.post('/logout', (req, reply) => {
    req.session.destroy();
    reply.send({ ok: true });
  });
}
