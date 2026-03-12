import { config } from '../config.js';
import { readFileSync } from 'fs';

const { apiKey, baseUrl, models } = config.openrouter;

async function callOpenRouter(model, messages, options = {}) {
  const start = Date.now();
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://jobhacker.it',
      'X-Title': 'JobHacker',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: options.maxTokens || 4096,
      ...options.extra,
    }),
  });

  const elapsed = Date.now() - start;

  if (!res.ok) {
    const text = await res.text();
    console.error(`[AI] ${model} FAILED in ${elapsed}ms — ${res.status}: ${text.substring(0, 200)}`);
    throw new Error(`OpenRouter error ${res.status}: ${text.substring(0, 300)}`);
  }

  const data = await res.json();
  const usage = data.usage;
  console.log(`[AI] ${model} OK in ${elapsed}ms${usage ? ` — ${usage.prompt_tokens}in/${usage.completion_tokens}out` : ''}`);
  return data.choices[0].message.content;
}

async function parseDocument(absPath) {
  const fileBuffer = readFileSync(absPath);
  const base64 = fileBuffer.toString('base64');
  const ext = absPath.split('.').pop().toLowerCase();

  const mimeMap = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg', jpeg: 'image/jpeg',
    png: 'image/png', webp: 'image/webp',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  const mime = mimeMap[ext] || 'application/pdf';
  const dataUrl = `data:${mime};base64,${base64}`;

  // Gemini accepts PDFs and images via image_url with inline data
  const content = await callOpenRouter(models.ocr, [
    {
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: dataUrl } },
        { type: 'text', text: 'Extract all text from this document. Preserve structure: sections, bullet points, dates, job titles, company names. Return the raw text organized by sections.' },
      ],
    },
  ], { maxTokens: 8192 });

  return content;
}

async function getOpenRouterBalance() {
  const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`OpenRouter balance check failed: ${res.status}`);
  const data = await res.json();
  return {
    balance: data.data?.balance ?? null,
    limit: data.data?.limit ?? null,
    usage: data.data?.usage ?? null,
  };
}

export const openrouter = {
  generate: (messages, options) => callOpenRouter(models.generation, messages, options),
  analyze: (messages, options) => callOpenRouter(models.analysis, messages, options),
  score: (messages, options) => callOpenRouter(models.ats, messages, options),
  parseDocument,
  getBalance: getOpenRouterBalance,
  models,
};
