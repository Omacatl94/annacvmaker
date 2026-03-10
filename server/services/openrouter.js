import { config } from '../config.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { apiKey, baseUrl, models } = config.openrouter;

async function callOpenRouter(model, messages, options = {}) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://cvmaker.app',
      'X-Title': 'CV Maker',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: options.maxTokens || 4096,
      ...options.extra,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${text.substring(0, 300)}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

async function callMistralOCR(filePath) {
  const absPath = join(__dirname, '../..', filePath);
  const fileBuffer = readFileSync(absPath);
  const base64 = fileBuffer.toString('base64');
  const ext = filePath.split('.').pop().toLowerCase();

  const mimeMap = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg', jpeg: 'image/jpeg',
    png: 'image/png', webp: 'image/webp',
  };
  const mime = mimeMap[ext] || 'application/pdf';

  const content = await callOpenRouter(models.ocr, [
    {
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } },
        { type: 'text', text: 'Extract all text from this document. Preserve structure: sections, bullet points, dates, job titles, company names. Return the raw text organized by sections.' },
      ],
    },
  ], { maxTokens: 8192 });

  return content;
}

export const openrouter = {
  generate: (messages, options) => callOpenRouter(models.generation, messages, options),
  score: (messages, options) => callOpenRouter(models.ats, messages, options),
  parseDocument: callMistralOCR,
  models,
};
