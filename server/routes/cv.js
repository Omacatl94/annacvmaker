import { activeGuard, registeredGuard } from '../middleware/auth-guard.js';
import { generatePDF } from '../services/pdf-export.js';
import { writeFile, readFile } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const PDF_DIR = join(process.cwd(), 'uploads', 'pdfs');
if (!existsSync(PDF_DIR)) mkdirSync(PDF_DIR, { recursive: true });

export default async function cvRoutes(app) {
  app.addHook('preHandler', activeGuard);
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

  app.post('/export-pdf', {
    schema: {
      body: {
        type: 'object',
        required: ['html'],
        properties: {
          html: { type: 'string', maxLength: 512000 },
          filename: { type: 'string', maxLength: 120, pattern: '^[a-zA-Z0-9_ -]*$' },
          cvId: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const { html, filename, cvId } = req.body;
    if (!html) return reply.code(400).send({ error: 'html required' });

    try {
      const pdf = await generatePDF(html);

      // Cache PDF to disk if cvId provided
      if (cvId && userId(req)) {
        const pdfPath = join(PDF_DIR, `${cvId}.pdf`);
        await writeFile(pdfPath, pdf);
        await app.db.query(
          'UPDATE generated_cvs SET pdf_path = $1 WHERE id = $2 AND profile_id IN (SELECT id FROM cv_profiles WHERE user_id = $3)',
          [pdfPath, cvId, userId(req)]
        );
      }

      reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${(filename || 'cv').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 100)}.pdf"`)
        .send(pdf);
    } catch (err) {
      req.log.error(err);
      reply.code(500).send({ error: 'PDF generation failed' });
    }
  });

  // Serve cached PDF
  app.get('/generated/:id/pdf', { preHandler: registeredGuard }, async (req, reply) => {
    const { id } = req.params;
    const result = await app.db.query(
      `SELECT g.pdf_path, g.target_role, g.target_company
       FROM generated_cvs g JOIN cv_profiles p ON g.profile_id = p.id
       WHERE g.id = $1 AND p.user_id = $2`,
      [id, userId(req)]
    );
    if (!result.rows[0] || !result.rows[0].pdf_path) {
      return reply.code(404).send({ error: 'PDF not found' });
    }

    const { pdf_path, target_role, target_company } = result.rows[0];
    try {
      const pdf = await readFile(pdf_path);
      const name = [target_role, target_company].filter(Boolean).join('_').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 100) || 'cv';
      reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${name}.pdf"`)
        .send(pdf);
    } catch {
      return reply.code(404).send({ error: 'PDF file missing' });
    }
  });

  app.post('/generated', { preHandler: registeredGuard }, async (req, reply) => {
    const { profile_id, job_description, target_role, target_company, language, style, generated_data, ats_classic, ats_smart, location, source_type, source_url } = req.body;
    const profile = await app.db.query(
      'SELECT id FROM cv_profiles WHERE id = $1 AND user_id = $2', [profile_id, userId(req)]
    );
    if (!profile.rows[0]) return reply.code(404).send({ error: 'Profile not found' });

    const result = await app.db.query(
      `INSERT INTO generated_cvs (profile_id, job_description, target_role, target_company, language, style, generated_data, ats_classic, ats_smart, status, notes, location, source_type, source_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'sent', '', $10, $11, $12) RETURNING *`,
      [profile_id, job_description, target_role, target_company, language, style,
       JSON.stringify(generated_data), ats_classic || null, ats_smart || null, location || null,
       source_type || 'job_description', source_url || null]
    );
    reply.code(201).send(result.rows[0]);
  });

  app.put('/generated/:id', { preHandler: registeredGuard }, async (req, reply) => {
    const { id } = req.params;
    const { status, notes, ats_classic, ats_smart } = req.body;
    const existing = await app.db.query(
      `SELECT g.id FROM generated_cvs g
       JOIN cv_profiles p ON g.profile_id = p.id
       WHERE g.id = $1 AND p.user_id = $2`, [id, userId(req)]
    );
    if (!existing.rows[0]) return reply.code(404).send({ error: 'Generated CV not found' });

    const result = await app.db.query(
      `UPDATE generated_cvs
       SET status = COALESCE($1, status),
           notes = COALESCE($2, notes),
           ats_classic = COALESCE($3, ats_classic),
           ats_smart = COALESCE($4, ats_smart)
       WHERE id = $5 RETURNING *`,
      [status, notes, ats_classic ?? null, ats_smart ?? null, id]
    );
    reply.send(result.rows[0]);
  });
}
