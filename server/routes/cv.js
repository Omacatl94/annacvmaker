import { authGuard, registeredGuard } from '../middleware/auth-guard.js';
import { generatePDF } from '../services/pdf-export.js';

export default async function cvRoutes(app) {
  app.addHook('preHandler', authGuard);
  const userId = (req) => req.user?.id;

  app.get('/profiles', async (req, reply) => {
    if (!userId(req)) return reply.send([]);
    const result = await app.db.query(
      'SELECT * FROM cv_profiles WHERE user_id = $1 ORDER BY updated_at DESC',
      [userId(req)]
    );
    reply.send(result.rows);
  });

  app.post('/profiles', { preHandler: registeredGuard }, async (req, reply) => {
    const { label, personal, photo_path, experiences, education, skills, languages } = req.body;
    const result = await app.db.query(
      `INSERT INTO cv_profiles (user_id, label, personal, photo_path, experiences, education, skills, languages)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [userId(req), label || 'CV Principale',
       JSON.stringify(personal || {}), photo_path || null,
       JSON.stringify(experiences || []), JSON.stringify(education || []),
       JSON.stringify(skills || []), JSON.stringify(languages || [])]
    );
    reply.code(201).send(result.rows[0]);
  });

  app.put('/profiles/:id', { preHandler: registeredGuard }, async (req, reply) => {
    const { id } = req.params;
    const { label, personal, photo_path, experiences, education, skills, languages } = req.body;
    const existing = await app.db.query(
      'SELECT id FROM cv_profiles WHERE id = $1 AND user_id = $2', [id, userId(req)]
    );
    if (!existing.rows[0]) return reply.code(404).send({ error: 'Profile not found' });

    const result = await app.db.query(
      `UPDATE cv_profiles
       SET label = COALESCE($1, label),
           personal = COALESCE($2, personal),
           photo_path = COALESCE($3, photo_path),
           experiences = COALESCE($4, experiences),
           education = COALESCE($5, education),
           skills = COALESCE($6, skills),
           languages = COALESCE($7, languages),
           updated_at = NOW()
       WHERE id = $8 RETURNING *`,
      [label, personal ? JSON.stringify(personal) : null,
       photo_path, experiences ? JSON.stringify(experiences) : null,
       education ? JSON.stringify(education) : null,
       skills ? JSON.stringify(skills) : null,
       languages ? JSON.stringify(languages) : null, id]
    );
    reply.send(result.rows[0]);
  });

  app.delete('/profiles/:id', { preHandler: registeredGuard }, async (req, reply) => {
    const { id } = req.params;
    const result = await app.db.query(
      'DELETE FROM cv_profiles WHERE id = $1 AND user_id = $2 RETURNING id', [id, userId(req)]
    );
    if (!result.rows[0]) return reply.code(404).send({ error: 'Profile not found' });
    reply.send({ ok: true });
  });

  app.get('/generated', async (req, reply) => {
    if (!userId(req)) return reply.send([]);
    const result = await app.db.query(
      `SELECT g.*, p.label as profile_label FROM generated_cvs g
       JOIN cv_profiles p ON g.profile_id = p.id
       WHERE p.user_id = $1
       ORDER BY g.created_at DESC LIMIT 50`,
      [userId(req)]
    );
    reply.send(result.rows);
  });

  app.post('/export-pdf', async (req, reply) => {
    const { html, filename } = req.body;
    if (!html) return reply.code(400).send({ error: 'html required' });

    try {
      const pdf = await generatePDF(html);
      reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${(filename || 'cv').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 100)}.pdf"`)
        .send(pdf);
    } catch (err) {
      req.log.error(err);
      reply.code(500).send({ error: 'PDF generation failed' });
    }
  });

  app.post('/generated', { preHandler: registeredGuard }, async (req, reply) => {
    const { profile_id, job_description, target_role, target_company, language, style, generated_data, ats_classic, ats_smart, location } = req.body;
    const profile = await app.db.query(
      'SELECT id FROM cv_profiles WHERE id = $1 AND user_id = $2', [profile_id, userId(req)]
    );
    if (!profile.rows[0]) return reply.code(404).send({ error: 'Profile not found' });

    const result = await app.db.query(
      `INSERT INTO generated_cvs (profile_id, job_description, target_role, target_company, language, style, generated_data, ats_classic, ats_smart, status, notes, location)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'sent', '', $10) RETURNING *`,
      [profile_id, job_description, target_role, target_company, language, style,
       JSON.stringify(generated_data), ats_classic || null, ats_smart || null, location || null]
    );
    reply.code(201).send(result.rows[0]);
  });

  app.put('/generated/:id', { preHandler: registeredGuard }, async (req, reply) => {
    const { id } = req.params;
    const { status, notes } = req.body;
    const existing = await app.db.query(
      `SELECT g.id FROM generated_cvs g
       JOIN cv_profiles p ON g.profile_id = p.id
       WHERE g.id = $1 AND p.user_id = $2`, [id, userId(req)]
    );
    if (!existing.rows[0]) return reply.code(404).send({ error: 'Generated CV not found' });

    const result = await app.db.query(
      `UPDATE generated_cvs
       SET status = COALESCE($1, status),
           notes = COALESCE($2, notes)
       WHERE id = $3 RETURNING *`,
      [status, notes, id]
    );
    reply.send(result.rows[0]);
  });
}
