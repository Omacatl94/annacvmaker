import { readFileSync } from 'fs';

function env(key, fallback) {
  const val = process.env[key];
  if (val === undefined && fallback === undefined) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return val ?? fallback;
}

// Load .env manually (no dotenv dependency)
try {
  const envFile = readFileSync('.env', 'utf8');
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch {}

export const config = {
  port: parseInt(env('PORT', '3000')),
  jwtSecret: env('SESSION_SECRET'),
  db: {
    host: env('DB_HOST', 'localhost'),
    port: parseInt(env('DB_PORT', '5432')),
    database: env('DB_NAME', 'cvmaker'),
    user: env('DB_USER', 'cvmaker'),
    password: env('DB_PASSWORD'),
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
  },
  openrouter: {
    apiKey: env('OPENROUTER_API_KEY'),
    baseUrl: 'https://openrouter.ai/api/v1',
    models: {
      generation: 'anthropic/claude-sonnet-4-6',
      analysis: 'anthropic/claude-sonnet-4-6',
      ats: 'anthropic/claude-haiku-4.5',
      ocr: 'google/gemini-2.5-flash',
    },
  },
  google: {
    clientId: env('GOOGLE_CLIENT_ID', ''),
    clientSecret: env('GOOGLE_CLIENT_SECRET', ''),
    callbackUrl: env('GOOGLE_CALLBACK_URL', 'http://localhost:3000/api/auth/google/callback'),
  },
  linkedin: {
    clientId: env('LINKEDIN_CLIENT_ID', ''),
    clientSecret: env('LINKEDIN_CLIENT_SECRET', ''),
    callbackUrl: env('LINKEDIN_CALLBACK_URL', 'http://localhost:3000/api/auth/linkedin/callback'),
  },
  stripe: {
    secretKey: env('STRIPE_SECRET_KEY', ''),
    webhookSecret: env('STRIPE_WEBHOOK_SECRET', ''),
  },
  openBeta: env('OPEN_BETA', 'false') === 'true',
  openBetaDailyLimit: parseInt(env('OPEN_BETA_DAILY_LIMIT', '2')),
  inviteOnly: env('INVITE_ONLY', 'true') === 'true',
  adminEmails: env('ADMIN_EMAILS', '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean),
  upload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    photoDir: 'uploads/photos',
    cvDir: 'uploads/cvs',
  },
  appOrigin: env('APP_ORIGIN', 'https://app.jobhacker.it'),
  allowedOrigins: (() => {
    const raw = env('ALLOWED_ORIGINS', '');
    if (raw) return raw.split(',').map(s => s.trim()).filter(Boolean);
    const origin = env('APP_ORIGIN', 'https://app.jobhacker.it');
    return [origin, 'https://jobhacker.it'];
  })(),
  cookieSecure: env('COOKIE_SECURE', 'true') === 'true',
  resendApiKey: env('RESEND_API_KEY', ''),
  emailFrom: env('EMAIL_FROM', 'JobHacker <noreply@jobhacker.it>'),
};
