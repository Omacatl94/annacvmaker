import { authGuard } from '../middleware/auth-guard.js';
import { rateLimit } from '../middleware/rate-limit.js';
import { creditGuard } from '../middleware/credits.js';
import { openrouter } from '../services/openrouter.js';
import { safePath } from '../utils/safe-path.js';
import { consumeCredits } from '../services/credits.js';
import { buildGenerationPrompt } from '../services/prompt-builder.js';
import { buildAnalyzerPrompt } from '../services/cv-analyzer.js';
import { buildATSPrompt, buildOptimizePrompt, buildKeywordExtractionPrompt, buildFitScorePrompt } from '../services/ats-scorer.js';
import { buildCoverLetterPrompt } from '../services/cover-letter-builder.js';

function parseJSON(raw) {
  let jsonStr = raw;
  const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) jsonStr = match[1];
  return JSON.parse(jsonStr.trim());
}

// Rate limits: generation (expensive) is tighter than scoring (cheap)
const aiHeavyLimit = rateLimit({ windowMs: 60000, max: 5 });
const aiLightLimit = rateLimit({ windowMs: 60000, max: 15 });

export default async function aiRoutes(app) {
  app.addHook('preHandler', authGuard);

  app.post('/parse-cv', { preHandler: aiHeavyLimit }, async (req, reply) => {
    const { filePath } = req.body;
    if (!filePath) return reply.code(400).send({ error: 'filePath required' });
    const absPath = safePath(filePath);

    const rawText = await openrouter.parseDocument(absPath);

    const structurePrompt = `You are a CV parser. Given raw text extracted from a CV document, extract and structure the data into JSON.

RAW CV TEXT:
${rawText}

Return ONLY valid JSON:
{
  "personal": { "name": "Full Name", "email": "email", "phone": "phone", "location": "City, Country" },
  "experiences": [{ "role": "Title", "company": "Company, City", "period": "Start - End", "bullets": ["bullet1"] }],
  "education": [{ "degree": "Degree", "school": "University", "period": "Start - End", "grade": "grade or null" }],
  "skills": ["Skill 1", "Skill 2"],
  "languages": [{ "language": "Language", "level": "Level" }]
}
Rules: Extract ONLY what is explicitly written. Never invent data. Order experiences by most recent first.`;

    const structured = await openrouter.generate([{ role: 'user', content: structurePrompt }]);
    try {
      const parsed = parseJSON(structured);
      reply.send({ raw: rawText, structured: parsed });
    } catch {
      app.db.query(
        `INSERT INTO error_logs (level, endpoint, message, user_id, status_code)
         VALUES ('warn', $1, $2, $3, 422)`,
        [`POST /api/ai/parse-cv`, 'JSON parse failure: ' + (structured || '').substring(0, 500), req.user?.id]
      ).catch(() => {});
      reply.code(422).send({ error: 'Failed to parse CV structure', raw: rawText });
    }
  });

  app.post('/analyze', { preHandler: aiHeavyLimit }, async (req, reply) => {
    const { profile, jobDescription, language } = req.body;
    if (!profile || !jobDescription) return reply.code(400).send({ error: 'profile and jobDescription required' });

    const prompt = buildAnalyzerPrompt(profile, jobDescription, language || 'it');
    const result = await openrouter.analyze([{ role: 'user', content: prompt }]);
    try {
      reply.send(parseJSON(result));
    } catch {
      app.db.query(
        `INSERT INTO error_logs (level, endpoint, message, user_id, status_code)
         VALUES ('warn', $1, $2, $3, 422)`,
        [`POST /api/ai/analyze`, 'JSON parse failure: ' + (result || '').substring(0, 500), req.user?.id]
      ).catch(() => {});
      reply.code(422).send({ error: 'Failed to parse analysis', raw: result });
    }
  });

  app.post('/fit-score', { preHandler: aiLightLimit }, async (req, reply) => {
    const { profile, jobDescription, language } = req.body;
    if (!profile || !jobDescription) return reply.code(400).send({ error: 'profile and jobDescription required' });

    const prompt = buildFitScorePrompt(profile, jobDescription, language || 'it');
    const result = await openrouter.score([{ role: 'user', content: prompt }]);
    try {
      reply.send(parseJSON(result));
    } catch {
      app.db.query(
        `INSERT INTO error_logs (level, endpoint, message, user_id, status_code)
         VALUES ('warn', $1, $2, $3, 422)`,
        [`POST /api/ai/fit-score`, 'JSON parse failure: ' + (result || '').substring(0, 500), req.user?.id]
      ).catch(() => {});
      reply.code(422).send({ error: 'Failed to parse fit score', raw: result });
    }
  });

  app.post('/extract-keywords', { preHandler: aiLightLimit }, async (req, reply) => {
    const { jobDescription, language } = req.body;
    if (!jobDescription) return reply.code(400).send({ error: 'jobDescription required' });

    const prompt = buildKeywordExtractionPrompt(jobDescription, language || 'it');
    const result = await openrouter.score([{ role: 'user', content: prompt }]);
    try {
      reply.send(parseJSON(result));
    } catch {
      app.db.query(
        `INSERT INTO error_logs (level, endpoint, message, user_id, status_code)
         VALUES ('warn', $1, $2, $3, 422)`,
        [`POST /api/ai/extract-keywords`, 'JSON parse failure: ' + (result || '').substring(0, 500), req.user?.id]
      ).catch(() => {});
      reply.code(422).send({ error: 'Failed to parse keyword extraction', raw: result });
    }
  });

  app.post('/generate', { preHandler: [aiHeavyLimit, creditGuard('cv_generation')] }, async (req, reply) => {
    const { profile, jobDescription, language, targetKeywords } = req.body;
    if (!profile || !jobDescription) return reply.code(400).send({ error: 'profile and jobDescription required' });

    const prompt = buildGenerationPrompt(profile, jobDescription, language || 'it', targetKeywords || null);
    const result = await openrouter.generate([{ role: 'user', content: prompt }]);
    try {
      const parsed = parseJSON(result);
      // Consume credit after successful generation
      await consumeCredits(req.server.db, req.user.id, 'cv_generation');
      reply.send(parsed);
    } catch {
      app.db.query(
        `INSERT INTO error_logs (level, endpoint, message, user_id, status_code)
         VALUES ('warn', $1, $2, $3, 422)`,
        [`POST /api/ai/generate`, 'JSON parse failure: ' + (result || '').substring(0, 500), req.user?.id]
      ).catch(() => {});
      reply.code(422).send({ error: 'Failed to parse generated CV', raw: result });
    }
  });

  app.post('/ats-score', { preHandler: aiLightLimit }, async (req, reply) => {
    const { cvText, jobDescription, language, lockedKeywords } = req.body;
    if (!cvText || !jobDescription) return reply.code(400).send({ error: 'cvText and jobDescription required' });

    const prompt = buildATSPrompt(cvText, jobDescription, language || 'it', lockedKeywords);
    const result = await openrouter.score([{ role: 'user', content: prompt }]);
    try {
      reply.send(parseJSON(result));
    } catch {
      app.db.query(
        `INSERT INTO error_logs (level, endpoint, message, user_id, status_code)
         VALUES ('warn', $1, $2, $3, 422)`,
        [`POST /api/ai/ats-score`, 'JSON parse failure: ' + (result || '').substring(0, 500), req.user?.id]
      ).catch(() => {});
      reply.code(422).send({ error: 'Failed to parse ATS score', raw: result });
    }
  });

  app.post('/optimize', { preHandler: aiHeavyLimit }, async (req, reply) => {
    const { generatedData, jobDescription, language, profile,
            selectedKeywords, missingKeywords, semanticKeywords, exactKeywords } = req.body;
    if (!generatedData || !jobDescription) {
      return reply.code(400).send({ error: 'generatedData and jobDescription required' });
    }

    // Accept either unified selectedKeywords or split missing/semantic/exact arrays
    const keywords = selectedKeywords || {
      missing: missingKeywords || [],
      semantic: semanticKeywords || [],
      exact: exactKeywords || [],
    };

    const prompt = buildOptimizePrompt(generatedData, keywords, jobDescription, language || 'it', profile);
    const result = await openrouter.generate([{ role: 'user', content: prompt }]);
    try {
      reply.send(parseJSON(result));
    } catch {
      app.db.query(
        `INSERT INTO error_logs (level, endpoint, message, user_id, status_code)
         VALUES ('warn', $1, $2, $3, 422)`,
        [`POST /api/ai/optimize`, 'JSON parse failure: ' + (result || '').substring(0, 500), req.user?.id]
      ).catch(() => {});
      reply.code(422).send({ error: 'Failed to parse optimization', raw: result });
    }
  });

  app.post('/cover-letter', { preHandler: [aiHeavyLimit, creditGuard('cover_letter')] }, async (req, reply) => {
    const { profile, jobDescription, generatedData, language } = req.body;
    if (!profile || !jobDescription || !generatedData) {
      return reply.code(400).send({ error: 'profile, jobDescription, and generatedData required' });
    }

    const prompt = buildCoverLetterPrompt(profile, jobDescription, generatedData, language || 'it');
    const result = await openrouter.generate([{ role: 'user', content: prompt }]);
    try {
      const parsed = parseJSON(result);
      await consumeCredits(req.server.db, req.user.id, 'cover_letter');
      reply.send(parsed);
    } catch {
      app.db.query(
        `INSERT INTO error_logs (level, endpoint, message, user_id, status_code)
         VALUES ('warn', $1, $2, $3, 422)`,
        [`POST /api/ai/cover-letter`, 'JSON parse failure: ' + (result || '').substring(0, 500), req.user?.id]
      ).catch(() => {});
      reply.code(422).send({ error: 'Failed to parse cover letter', raw: result });
    }
  });
}
