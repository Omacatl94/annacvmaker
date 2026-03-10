import { authGuard } from '../middleware/auth-guard.js';
import { openrouter } from '../services/openrouter.js';
import { buildGenerationPrompt } from '../services/prompt-builder.js';
import { buildAnalyzerPrompt } from '../services/cv-analyzer.js';
import { buildATSPrompt, buildOptimizePrompt } from '../services/ats-scorer.js';

function parseJSON(raw) {
  let jsonStr = raw;
  const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) jsonStr = match[1];
  return JSON.parse(jsonStr.trim());
}

export default async function aiRoutes(app) {
  app.addHook('preHandler', authGuard);

  app.post('/parse-cv', async (req, reply) => {
    const { filePath } = req.body;
    if (!filePath) return reply.code(400).send({ error: 'filePath required' });

    const rawText = await openrouter.parseDocument(filePath);

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
      reply.code(422).send({ error: 'Failed to parse CV structure', raw: rawText });
    }
  });

  app.post('/analyze', async (req, reply) => {
    const { profile, jobDescription, language } = req.body;
    if (!profile || !jobDescription) return reply.code(400).send({ error: 'profile and jobDescription required' });

    const prompt = buildAnalyzerPrompt(profile, jobDescription, language || 'it');
    const result = await openrouter.generate([{ role: 'user', content: prompt }]);
    try {
      reply.send(parseJSON(result));
    } catch {
      reply.code(422).send({ error: 'Failed to parse analysis', raw: result });
    }
  });

  app.post('/generate', async (req, reply) => {
    const { profile, jobDescription, language } = req.body;
    if (!profile || !jobDescription) return reply.code(400).send({ error: 'profile and jobDescription required' });

    const prompt = buildGenerationPrompt(profile, jobDescription, language || 'it');
    const result = await openrouter.generate([{ role: 'user', content: prompt }]);
    try {
      reply.send(parseJSON(result));
    } catch {
      reply.code(422).send({ error: 'Failed to parse generated CV', raw: result });
    }
  });

  app.post('/ats-score', async (req, reply) => {
    const { cvText, jobDescription, language, lockedKeywords } = req.body;
    if (!cvText || !jobDescription) return reply.code(400).send({ error: 'cvText and jobDescription required' });

    const prompt = buildATSPrompt(cvText, jobDescription, language || 'it', lockedKeywords);
    const result = await openrouter.score([{ role: 'user', content: prompt }]);
    try {
      reply.send(parseJSON(result));
    } catch {
      reply.code(422).send({ error: 'Failed to parse ATS score', raw: result });
    }
  });

  app.post('/optimize', async (req, reply) => {
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
      reply.code(422).send({ error: 'Failed to parse optimization', raw: result });
    }
  });
}
