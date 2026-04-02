# Universal CV Maker — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Evolve annacvmaker from a single-user hardcoded CV tool into a multi-user platform with social auth, CV upload/parsing via Mistral OCR, strategic onboarding, AI CV generation, dual ATS scoring, and 3 CSS themes.

**Architecture:** Monolite Fastify server serving a vanilla JS SPA, with PostgreSQL for persistence and Docker Compose for deployment. All AI calls proxied through the server via OpenRouter (Claude Opus for generation, Haiku for ATS, Mistral OCR for parsing). Social login via Google + LinkedIn OAuth.

**Tech Stack:** Node.js 20+, Fastify 5, PostgreSQL 16, Docker/Docker Compose, vanilla JS (ES modules), CSS Custom Properties for themes, OpenRouter API.

**Source of truth for logic:** The current `index.html` (2267 lines) contains all proven prompt engineering, ATS scoring, and CV rendering logic. Each task references exact line ranges to extract and adapt.

**Security note:** All dynamic content rendering in the frontend must use `textContent` for plain text or safe DOM construction methods (createElement, appendChild). Use DOMPurify for any HTML that includes user-generated content. Never use raw innerHTML with untrusted data.

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `server/config.js`
- Move: `index.html` to `legacy/index.html` (preserve original)

**Step 1: Initialize project**

```bash
cd /Users/paolodiana/Documents/annacvmaker
mkdir -p server/{plugins,routes,services,db/migrations,middleware} public/{css,js,assets/fonts} legacy
cp index.html legacy/index.html
cp 1671557744955.jpg legacy/
```

**Step 2: Create package.json**

```json
{
  "name": "cvmaker",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "node --watch server/index.js",
    "start": "node server/index.js",
    "migrate": "node server/db/migrate.js",
    "test": "node --test server/**/*.test.js"
  },
  "dependencies": {
    "fastify": "^5.3.0",
    "@fastify/static": "^8.1.0",
    "@fastify/cookie": "^11.0.0",
    "@fastify/session": "^11.0.0",
    "@fastify/multipart": "^9.0.0",
    "@fastify/cors": "^10.0.0",
    "@fastify/formbody": "^8.0.0",
    "pg": "^8.13.0",
    "dompurify": "^3.2.0",
    "jsdom": "^25.0.0"
  }
}
```

**Step 3: Create .gitignore**

```
node_modules/
.env
uploads/
*.log
```

**Step 4: Create .env.example**

```env
# Server
PORT=3000
SESSION_SECRET=change-me-to-random-string

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cvmaker
DB_USER=cvmaker
DB_PASSWORD=change-me

# OpenRouter
OPENROUTER_API_KEY=sk-or-...

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

# LinkedIn OAuth
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_CALLBACK_URL=http://localhost:3000/api/auth/linkedin/callback
```

**Step 5: Create server/config.js**

```js
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
  sessionSecret: env('SESSION_SECRET'),
  db: {
    host: env('DB_HOST', 'localhost'),
    port: parseInt(env('DB_PORT', '5432')),
    database: env('DB_NAME', 'cvmaker'),
    user: env('DB_USER', 'cvmaker'),
    password: env('DB_PASSWORD'),
  },
  openrouter: {
    apiKey: env('OPENROUTER_API_KEY'),
    baseUrl: 'https://openrouter.ai/api/v1',
    models: {
      generation: 'anthropic/claude-opus-4-6',
      ats: 'anthropic/claude-haiku-4.5',
      ocr: 'mistral-ocr-latest',
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
  upload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    photoDir: 'uploads/photos',
    cvDir: 'uploads/cvs',
  },
};
```

**Step 6: Install dependencies and commit**

```bash
npm install
git add package.json .gitignore .env.example server/config.js legacy/
git commit -m "feat: scaffold project structure and config"
```

---

## Task 2: Docker & Database Setup

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `server/db/connection.js`
- Create: `server/db/migrate.js`
- Create: `server/db/migrations/001-initial-schema.sql`

**Step 1: Create docker-compose.yml**

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file: .env
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - uploads:/app/uploads
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: ${DB_NAME:-cvmaker}
      POSTGRES_USER: ${DB_USER:-cvmaker}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-changeme}
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-cvmaker}"]
      interval: 5s
      timeout: 3s
      retries: 5
    restart: unless-stopped

volumes:
  pgdata:
  uploads:
```

Note: Nginx container omitted for local dev. Added in Task 21 (deploy).

**Step 2: Create Dockerfile**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN mkdir -p uploads/photos uploads/cvs
EXPOSE 3000
CMD ["node", "server/index.js"]
```

**Step 3: Create database connection**

Create `server/db/connection.js`:

```js
import pg from 'pg';
import { config } from '../config.js';

const pool = new pg.Pool(config.db);

export const db = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  pool,
};
```

**Step 4: Create migration runner**

Create `server/db/migrate.js`:

```js
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { db } from './connection.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, 'migrations');

async function migrate() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT NOW()
    )
  `);

  const applied = await db.query('SELECT name FROM _migrations ORDER BY name');
  const appliedSet = new Set(applied.rows.map(r => r.name));

  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (appliedSet.has(file)) continue;
    console.log(`Applying: ${file}`);
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    await db.query(sql);
    await db.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
  }

  console.log('Migrations complete.');
  await db.pool.end();
}

migrate().catch(err => { console.error(err); process.exit(1); });
```

**Step 5: Create initial schema migration**

Create `server/db/migrations/001-initial-schema.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  name          VARCHAR(255),
  google_id     VARCHAR(255) UNIQUE,
  linkedin_id   VARCHAR(255) UNIQUE,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE cv_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  label         VARCHAR(100) DEFAULT 'CV Principale',
  personal      JSONB NOT NULL DEFAULT '{}',
  photo_path    VARCHAR(500),
  experiences   JSONB NOT NULL DEFAULT '[]',
  education     JSONB NOT NULL DEFAULT '[]',
  skills        JSONB NOT NULL DEFAULT '[]',
  languages     JSONB NOT NULL DEFAULT '[]',
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE generated_cvs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    UUID REFERENCES cv_profiles(id) ON DELETE CASCADE,
  job_description TEXT NOT NULL,
  target_role   VARCHAR(255),
  target_company VARCHAR(255),
  language      VARCHAR(2) NOT NULL DEFAULT 'it',
  style         VARCHAR(20) NOT NULL DEFAULT 'professional',
  generated_data JSONB NOT NULL,
  ats_classic   INTEGER,
  ats_smart     INTEGER,
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE sessions (
  sid           VARCHAR(255) PRIMARY KEY,
  sess          JSONB NOT NULL,
  expire        TIMESTAMP NOT NULL
);
CREATE INDEX idx_sessions_expire ON sessions (expire);
CREATE INDEX idx_cv_profiles_user ON cv_profiles (user_id);
CREATE INDEX idx_generated_cvs_profile ON generated_cvs (profile_id);
```

**Step 6: Verify database starts and migration runs**

```bash
docker compose up db -d
# Wait for healthy, then:
cp .env.example .env  # edit with real values
node server/db/migrate.js
```

Expected: "Applying: 001-initial-schema.sql" then "Migrations complete."

**Step 7: Commit**

```bash
git add Dockerfile docker-compose.yml server/db/
git commit -m "feat: add Docker setup and database with migrations"
```

---

## Task 3: Fastify Server Core

**Files:**
- Create: `server/index.js`
- Create: `server/plugins/static.js`
- Create: `server/plugins/cors.js`
- Create: `server/middleware/auth-guard.js`
- Create: `public/index.html` (SPA shell)

**Step 1: Create Fastify entry point**

Create `server/index.js`:

```js
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import session from '@fastify/session';
import formbody from '@fastify/formbody';
import multipart from '@fastify/multipart';
import { config } from './config.js';
import { registerStatic } from './plugins/static.js';
import { registerCors } from './plugins/cors.js';
import { db } from './db/connection.js';

const app = Fastify({ logger: true });

// Plugins
await app.register(registerCors);
await app.register(cookie);
await app.register(session, {
  secret: config.sessionSecret,
  cookie: {
    secure: false, // true in production with HTTPS
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
  saveUninitialized: false,
});
await app.register(formbody);
await app.register(multipart, {
  limits: { fileSize: config.upload.maxFileSize },
});

// Store db on app for routes
app.decorate('db', db);

// Routes (registered in later tasks)
// await app.register(authRoutes, { prefix: '/api/auth' });
// await app.register(cvRoutes, { prefix: '/api/cv' });
// await app.register(aiRoutes, { prefix: '/api/ai' });
// await app.register(uploadRoutes, { prefix: '/api/upload' });

// Static files (must be last — catches unmatched routes for SPA)
await app.register(registerStatic);

// Start
try {
  await app.listen({ port: config.port, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
```

**Step 2: Create static plugin**

Create `server/plugins/static.js`:

```js
import fastifyStatic from '@fastify/static';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '../../public');

export async function registerStatic(app) {
  await app.register(fastifyStatic, {
    root: publicDir,
    prefix: '/',
  });

  // SPA fallback: serve index.html for non-API, non-file routes
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/')) {
      reply.code(404).send({ error: 'Not found' });
    } else {
      reply.type('text/html').send(readFileSync(join(publicDir, 'index.html')));
    }
  });
}
```

**Step 3: Create CORS plugin**

Create `server/plugins/cors.js`:

```js
import cors from '@fastify/cors';

export async function registerCors(app) {
  await app.register(cors, {
    origin: true,
    credentials: true,
  });
}
```

**Step 4: Create auth guard middleware**

Create `server/middleware/auth-guard.js`:

```js
export function authGuard(request, reply, done) {
  if (!request.session?.userId) {
    reply.code(401).send({ error: 'Not authenticated' });
    return;
  }
  done();
}
```

**Step 5: Create SPA shell**

Create `public/index.html`:

```html
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CV Maker</title>
  <link rel="stylesheet" href="/css/app.css">
  <link rel="stylesheet" href="/css/cv-layout.css">
  <link rel="stylesheet" href="/css/cv-themes.css">
</head>
<body>
  <div id="app">
    <p>CV Maker is loading...</p>
  </div>
  <script type="module" src="/js/app.js"></script>
</body>
</html>
```

**Step 6: Create minimal app.js to verify server works**

Create `public/js/app.js`:

```js
const app = document.getElementById('app');
app.textContent = 'CV Maker — Server is running.';
```

Create `public/css/app.css`:

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: system-ui, -apple-system, sans-serif;
  color: #2d3748;
  background: #f5f5f5;
  line-height: 1.5;
}
#app {
  max-width: 900px;
  margin: 40px auto;
  padding: 0 20px;
}
```

Create empty placeholder files:

```bash
touch public/css/cv-layout.css public/css/cv-themes.css
```

**Step 7: Test server starts**

```bash
node server/index.js
# Expected: Server listening on 0.0.0.0:3000
# Visit http://localhost:3000 — see "CV Maker — Server is running."
```

**Step 8: Commit**

```bash
git add server/index.js server/plugins/ server/middleware/ public/
git commit -m "feat: add Fastify server with static SPA shell"
```

---

## Task 4: Auth — Google & LinkedIn OAuth

**Files:**
- Create: `server/routes/auth.js`
- Create: `server/services/oauth.js`

**Step 1: Create OAuth service**

Create `server/services/oauth.js`:

```js
import { config } from '../config.js';

// Google OAuth helpers
export const google = {
  getAuthUrl() {
    const params = new URLSearchParams({
      client_id: config.google.clientId,
      redirect_uri: config.google.callbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  },

  async getToken(code) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.google.clientId,
        client_secret: config.google.clientSecret,
        redirect_uri: config.google.callbackUrl,
        grant_type: 'authorization_code',
      }),
    });
    return res.json();
  },

  async getUserInfo(accessToken) {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.json();
  },
};

// LinkedIn OAuth helpers
export const linkedin = {
  getAuthUrl() {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.linkedin.clientId,
      redirect_uri: config.linkedin.callbackUrl,
      scope: 'openid profile email',
    });
    return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
  },

  async getToken(code) {
    const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: config.linkedin.clientId,
        client_secret: config.linkedin.clientSecret,
        redirect_uri: config.linkedin.callbackUrl,
      }),
    });
    return res.json();
  },

  async getUserInfo(accessToken) {
    const res = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.json();
  },
};
```

**Step 2: Create auth routes**

Create `server/routes/auth.js`:

```js
import { google, linkedin } from '../services/oauth.js';

export default async function authRoutes(app) {
  // Find or create user in DB
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
```

**Step 3: Register auth routes in server/index.js**

Uncomment and add:
```js
import authRoutes from './routes/auth.js';
await app.register(authRoutes, { prefix: '/api/auth' });
```

**Step 4: Test auth flow**

```bash
# Start server, visit http://localhost:3000/api/auth/me
# Expected: {"user":null}
```

**Step 5: Commit**

```bash
git add server/routes/auth.js server/services/oauth.js server/index.js
git commit -m "feat: add Google and LinkedIn OAuth authentication"
```

---

## Task 5: Upload Routes (Photo + CV File)

**Files:**
- Create: `server/routes/upload.js`

**Step 1: Create upload routes**

Create `server/routes/upload.js`:

```js
import { createWriteStream, mkdirSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { pipeline } from 'stream/promises';
import { authGuard } from '../middleware/auth-guard.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const uploadsBase = join(__dirname, '../..', 'uploads');

mkdirSync(join(uploadsBase, 'photos'), { recursive: true });
mkdirSync(join(uploadsBase, 'cvs'), { recursive: true });

const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_CV_TYPES = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export default async function uploadRoutes(app) {
  app.addHook('preHandler', authGuard);

  app.post('/photo', async (req, reply) => {
    const file = await req.file();
    if (!file) return reply.code(400).send({ error: 'No file uploaded' });
    if (!ALLOWED_PHOTO_TYPES.includes(file.mimetype)) {
      return reply.code(400).send({ error: 'Invalid file type. Use JPEG, PNG, or WebP.' });
    }
    const ext = extname(file.filename) || '.jpg';
    const name = `${randomUUID()}${ext}`;
    const dest = join(uploadsBase, 'photos', name);
    await pipeline(file.file, createWriteStream(dest));
    reply.send({ path: `/uploads/photos/${name}` });
  });

  app.post('/cv-file', async (req, reply) => {
    const file = await req.file();
    if (!file) return reply.code(400).send({ error: 'No file uploaded' });
    if (!ALLOWED_CV_TYPES.includes(file.mimetype)) {
      return reply.code(400).send({ error: 'Invalid file type. Use PDF, DOCX, JPEG, or PNG.' });
    }
    const ext = extname(file.filename) || '.pdf';
    const name = `${randomUUID()}${ext}`;
    const dest = join(uploadsBase, 'cvs', name);
    await pipeline(file.file, createWriteStream(dest));
    reply.send({ path: `/uploads/cvs/${name}`, filename: file.filename });
  });
}
```

**Step 2: Serve uploads as static files**

In `server/plugins/static.js`, add a second static registration for uploads:

```js
// After the public static registration:
await app.register(fastifyStatic, {
  root: join(__dirname, '../../uploads'),
  prefix: '/uploads/',
  decorateReply: false,
});
```

**Step 3: Register in server/index.js**

```js
import uploadRoutes from './routes/upload.js';
await app.register(uploadRoutes, { prefix: '/api/upload' });
```

**Step 4: Commit**

```bash
git add server/routes/upload.js server/plugins/static.js server/index.js
git commit -m "feat: add photo and CV file upload endpoints"
```

---

## Task 6: CV Profiles CRUD

**Files:**
- Create: `server/routes/cv.js`

**Step 1: Create CV routes**

Create `server/routes/cv.js`:

```js
import { authGuard } from '../middleware/auth-guard.js';

export default async function cvRoutes(app) {
  app.addHook('preHandler', authGuard);
  const userId = (req) => req.session.userId;

  app.get('/profiles', async (req, reply) => {
    const result = await app.db.query(
      'SELECT * FROM cv_profiles WHERE user_id = $1 ORDER BY updated_at DESC',
      [userId(req)]
    );
    reply.send(result.rows);
  });

  app.post('/profiles', async (req, reply) => {
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

  app.put('/profiles/:id', async (req, reply) => {
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

  app.delete('/profiles/:id', async (req, reply) => {
    const { id } = req.params;
    const result = await app.db.query(
      'DELETE FROM cv_profiles WHERE id = $1 AND user_id = $2 RETURNING id', [id, userId(req)]
    );
    if (!result.rows[0]) return reply.code(404).send({ error: 'Profile not found' });
    reply.send({ ok: true });
  });

  app.get('/generated', async (req, reply) => {
    const result = await app.db.query(
      `SELECT g.* FROM generated_cvs g
       JOIN cv_profiles p ON g.profile_id = p.id
       WHERE p.user_id = $1
       ORDER BY g.created_at DESC LIMIT 50`,
      [userId(req)]
    );
    reply.send(result.rows);
  });

  app.post('/generated', async (req, reply) => {
    const { profile_id, job_description, target_role, target_company, language, style, generated_data, ats_classic, ats_smart } = req.body;
    const profile = await app.db.query(
      'SELECT id FROM cv_profiles WHERE id = $1 AND user_id = $2', [profile_id, userId(req)]
    );
    if (!profile.rows[0]) return reply.code(404).send({ error: 'Profile not found' });

    const result = await app.db.query(
      `INSERT INTO generated_cvs (profile_id, job_description, target_role, target_company, language, style, generated_data, ats_classic, ats_smart)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [profile_id, job_description, target_role, target_company, language, style,
       JSON.stringify(generated_data), ats_classic || null, ats_smart || null]
    );
    reply.code(201).send(result.rows[0]);
  });
}
```

**Step 2: Register in server/index.js**

```js
import cvRoutes from './routes/cv.js';
await app.register(cvRoutes, { prefix: '/api/cv' });
```

**Step 3: Commit**

```bash
git add server/routes/cv.js server/index.js
git commit -m "feat: add CV profiles and generated CVs CRUD endpoints"
```

---

## Task 7: OpenRouter Proxy & AI Routes

**Files:**
- Create: `server/services/openrouter.js`
- Create: `server/routes/ai.js`

**Step 1: Create OpenRouter client**

Create `server/services/openrouter.js`:

```js
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
```

**Step 2: Create AI routes**

Create `server/routes/ai.js`:

```js
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
    const { generatedData, selectedKeywords, jobDescription, language, profile } = req.body;
    if (!generatedData || !selectedKeywords || !jobDescription) {
      return reply.code(400).send({ error: 'generatedData, selectedKeywords, and jobDescription required' });
    }

    const prompt = buildOptimizePrompt(generatedData, selectedKeywords, jobDescription, language || 'it', profile);
    const result = await openrouter.generate([{ role: 'user', content: prompt }]);
    try {
      reply.send(parseJSON(result));
    } catch {
      reply.code(422).send({ error: 'Failed to parse optimization', raw: result });
    }
  });
}
```

**Step 3: Register in server/index.js**

```js
import aiRoutes from './routes/ai.js';
await app.register(aiRoutes, { prefix: '/api/ai' });
```

**Step 4: Commit**

```bash
git add server/services/openrouter.js server/routes/ai.js server/index.js
git commit -m "feat: add OpenRouter proxy and AI routes"
```

---

## Task 8: Prompt Builder Service (adapted from legacy)

**Files:**
- Create: `server/services/prompt-builder.js`

**Source:** Adapted from `legacy/index.html` lines 939-1119 (buildPrompt function). Key change: CV data from dynamic `profile` parameter instead of hardcoded CV_BASE.

**Step 1: Create prompt-builder.js**

See full implementation in design doc. The prompt preserves all 8 anti-hallucination rules but adapts:
- Skills pool from user's declared skills
- Dynamic bullet budget based on experience count
- Dynamic tenure calculations per experience
- No hardcoded names, companies, or dates

**Step 2: Commit**

```bash
git add server/services/prompt-builder.js
git commit -m "feat: add dynamic prompt builder adapted from legacy"
```

---

## Task 9: CV Analyzer Service (Strategic Onboarding)

**Files:**
- Create: `server/services/cv-analyzer.js`

**Step 1: Create cv-analyzer.js**

See full implementation in design doc. Produces observations with types: incongruence, improve, valorize.

**Step 2: Commit**

```bash
git add server/services/cv-analyzer.js
git commit -m "feat: add strategic CV analyzer for onboarding"
```

---

## Task 10: ATS Scorer Service (adapted from legacy)

**Files:**
- Create: `server/services/ats-scorer.js`

**Source:** Adapted from `legacy/index.html` lines 1601-1719 (scoreWithHaiku) and 1845-2025 (optimizeForATS).

**Step 1: Create ats-scorer.js**

See full implementation in design doc. Provides buildATSPrompt and buildOptimizePrompt functions.

**Step 2: Commit**

```bash
git add server/services/ats-scorer.js
git commit -m "feat: add ATS scoring and optimization prompts"
```

---

## Task 11: Rate Limiter Middleware

**Files:**
- Create: `server/middleware/rate-limit.js`

**Step 1: Create simple in-memory rate limiter**

Create `server/middleware/rate-limit.js`:

```js
const requests = new Map();

export function rateLimit({ windowMs = 60000, max = 20 } = {}) {
  return function rateLimitHook(request, reply, done) {
    const key = request.session?.userId || request.ip;
    const now = Date.now();
    if (!requests.has(key)) requests.set(key, []);
    const timestamps = requests.get(key).filter(t => now - t < windowMs);
    timestamps.push(now);
    requests.set(key, timestamps);
    if (timestamps.length > max) {
      reply.code(429).send({ error: 'Too many requests. Try again later.' });
      return;
    }
    done();
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of requests) {
    const valid = timestamps.filter(t => now - t < 300000);
    if (valid.length === 0) requests.delete(key);
    else requests.set(key, valid);
  }
}, 300000);
```

**Step 2: Apply to AI routes in server/routes/ai.js**

Add rate limiting hook inside aiRoutes function:
```js
import { rateLimit } from '../middleware/rate-limit.js';
app.addHook('preHandler', rateLimit({ windowMs: 60000, max: 10 }));
```

**Step 3: Commit**

```bash
git add server/middleware/rate-limit.js server/routes/ai.js
git commit -m "feat: add rate limiting middleware for AI routes"
```

---

## Task 12: Frontend — SPA Router & Auth UI

**Files:**
- Update: `public/js/app.js` (full SPA router)
- Create: `public/js/auth.js`
- Create: `public/js/api.js` (API client helper)
- Update: `public/css/app.css`
- Update: `public/index.html`

**Step 1: Create API client helper** (`public/js/api.js`)

Centralized fetch wrapper for all API calls. Handles JSON serialization, credentials, error extraction.

**Step 2: Create SPA router** (`public/js/app.js`)

Checks auth state via `/api/auth/me`. If not logged in, renders login page. If logged in, renders dashboard.

**Step 3: Create auth UI** (`public/js/auth.js`)

Login page with Google and LinkedIn buttons (links to `/api/auth/google` and `/api/auth/linkedin`). Logout handler.

**Step 4: Create placeholder dashboard** (`public/js/cv-form.js`)

Minimal dashboard with user info and logout button. Expanded in Task 13.

**Step 5: Update app.css** with login page and dashboard styles.

**Step 6: Commit**

```bash
git add public/js/ public/css/app.css public/index.html
git commit -m "feat: add SPA router, auth UI, and API client"
```

---

## Task 13: Frontend — CV Form (Manual Input)

**Files:**
- Update: `public/js/cv-form.js` (full implementation)

**Implementation:** Dynamic form with sections for personal info, photo upload, experiences (add/remove), education (add/remove), skills (tag input), languages. Saves to API on submit.

**Key UX elements:**
- Photo drag-and-drop with circular preview
- "Add Experience" / "Remove" buttons for dynamic sections
- Each experience has: role, company, period, and dynamic bullet points
- Profile label input for multiple profiles
- Save button calling `api.createProfile()` or `api.updateProfile()`

**Important:** All dynamic DOM creation should use `createElement`/`textContent` for user data, not template literals with user content directly injected. Use DOMPurify if any rich text rendering is needed.

**Step 1: Commit**

```bash
git add public/js/cv-form.js
git commit -m "feat: add CV profile form with dynamic sections"
```

---

## Task 14: Frontend — CV Upload & OCR Parsing

**Files:**
- Create: `public/js/cv-upload.js`

**Implementation:**
1. Drag-and-drop zone for PDF/DOCX/image files
2. On drop: upload file to `/api/upload/cv-file`
3. Call `/api/ai/parse-cv` with returned file path
4. Show loading state during parsing
5. On success: pre-fill CV form with structured data
6. Integrate as top section of cv-form.js

**Step 1: Commit**

```bash
git add public/js/cv-upload.js public/js/cv-form.js
git commit -m "feat: add CV upload with Mistral OCR parsing"
```

---

## Task 15: Frontend — Onboarding Cards UI

**Files:**
- Create: `public/js/onboarding.js`

**Implementation:**
1. After JD input, "Analyze" button calls `/api/ai/analyze`
2. Display overall_fit score
3. Render observation cards sorted by severity
4. Color-coded cards: red (incongruence), yellow (improve), green (valorize)
5. Action buttons per card type
6. On action: update profile data accordingly
7. "Proceed to generation" when all cards processed

**Step 1: Commit**

```bash
git add public/js/onboarding.js
git commit -m "feat: add strategic onboarding cards UI"
```

---

## Task 16: Frontend — CV Generation & Preview

**Files:**
- Create: `public/js/cv-generator.js`

**Source:** Adapt from `legacy/index.html` lines 847-935 (generateCV) and 1128-1210 (buildCVHTML).

**Implementation:**
1. Target role screen: JD textarea, language selector, style selector (3 theme previews)
2. "Generate" button calls `/api/ai/generate`
3. Progress bar with step labels
4. On success: render CV preview with dynamic template
5. Apply `data-theme` attribute for selected style

**Key changes from legacy:**
- Replace `CV_BASE` references with dynamic profile data
- Use safe DOM methods for rendering user content

**Step 1: Commit**

```bash
git add public/js/cv-generator.js
git commit -m "feat: add CV generation and preview"
```

---

## Task 17: CSS — CV Layout & 3 Themes

**Files:**
- Update: `public/css/cv-layout.css`
- Update: `public/css/cv-themes.css`

**Source:** Extract CV styles from `legacy/index.html` lines 7-500.

**Step 1:** Extract CV layout styles using CSS variables instead of hardcoded colors.

**Step 2:** Create 3 themes in cv-themes.css:
- Professional: Georgia, teal (#0d7377)
- Modern: Inter, navy (#1e3a5f)
- Minimal: Lato, grey (#333333)

**Step 3:** Add Google Fonts link to index.html (Inter, Lato).

**Step 4: Commit**

```bash
git add public/css/ public/index.html
git commit -m "feat: add CV layout CSS and 3 themes"
```

---

## Task 18: Frontend — ATS Scoring Panel

**Files:**
- Create: `public/js/ats-panel.js`

**Source:** Adapt from `legacy/index.html` lines 1551-1830 and 1398-1549.

**Implementation:**
1. "ATS Analysis" button below CV preview
2. Call `/api/ai/ats-score` with CV text + JD
3. Render dual circular gauges (Classic vs Smart)
4. Keyword breakdown: exact (green), semantic (purple), missing (red)
5. Checkboxes for keywords to optimize
6. "Optimize" button calls `/api/ai/optimize`
7. Changelog display (before/after)
8. Client-side fallback scorer from legacy computeATSScore

**Step 1: Commit**

```bash
git add public/js/ats-panel.js
git commit -m "feat: add ATS scoring panel with optimization"
```

---

## Task 19: Frontend — Inline Editor & Export

**Files:**
- Create: `public/js/cv-editor.js`
- Create: `public/js/cv-export.js`

**Source:** Adapt from `legacy/index.html` lines 2089-2123 (toggleEditMode) and download/print functions.

**Implementation:**
- Toggle contenteditable on data-field elements
- Sync edits back to generatedData
- Re-score ATS after save
- Export: standalone HTML with inlined CSS, dynamic filename
- Print: window.print() with @media print rules
- Save generated CV to DB

**Step 1: Commit**

```bash
git add public/js/cv-editor.js public/js/cv-export.js
git commit -m "feat: add inline CV editing and export"
```

---

## Task 20: Full Stack Local Test

**Files:**
- Create: `.env` from `.env.example`

**Step 1:** Create .env with development values (session secret, DB creds, OpenRouter key, OAuth credentials).

**Step 2:** Build and run:
```bash
docker compose up --build
```

**Step 3:** Test end-to-end flow:
1. Login with Google
2. Create profile (manual form)
3. Upload CV and verify OCR parsing
4. Enter JD and run onboarding analysis
5. Generate CV with selected theme
6. Run ATS scoring
7. Optimize keywords
8. Download HTML

**Step 4: Commit fixes**

```bash
git add <specific-files>
git commit -m "fix: integration fixes from end-to-end testing"
```

---

## Task 21: Deploy — DigitalOcean Droplet

**Files:**
- Create: `nginx.conf`
- Update: `docker-compose.yml` (add nginx service)
- Create: `deploy.sh`

**Step 1: Create nginx.conf**

```nginx
events { worker_connections 1024; }
http {
    upstream app { server app:3000; }
    server {
        listen 80;
        server_name _;
        client_max_body_size 10M;
        location / {
            proxy_pass http://app;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

**Step 2:** Add nginx service to docker-compose.yml.

**Step 3:** Create deploy.sh (rsync-based):

```bash
#!/bin/bash
set -e
DROPLET_IP="${1:?Usage: ./deploy.sh <droplet-ip>}"
rsync -avz --exclude='node_modules' --exclude='.env' --exclude='uploads' --exclude='.git' \
  ./ root@${DROPLET_IP}:/opt/cvmaker/
ssh root@${DROPLET_IP} "cd /opt/cvmaker && docker compose down && docker compose up -d --build && docker compose exec app node server/db/migrate.js"
```

**Step 4:** Test on droplet, access via IP.

**Step 5: Commit**

```bash
git add nginx.conf docker-compose.yml deploy.sh
git commit -m "feat: add nginx config and deploy script"
```

---

## Task Dependency Map

| # | Task | Depends on | Parallelizable with |
|---|---|---|---|
| 1 | Project Scaffolding | — | — |
| 2 | Docker & Database | 1 | — |
| 3 | Fastify Server Core | 1, 2 | — |
| 4 | Auth (OAuth) | 3 | 5, 6 |
| 5 | Upload Routes | 3 | 4, 6 |
| 6 | CV Profiles CRUD | 3 | 4, 5 |
| 7 | OpenRouter & AI Routes | 3, 8, 9, 10 | — |
| 8 | Prompt Builder | — | 9, 10, 17 |
| 9 | CV Analyzer | — | 8, 10, 17 |
| 10 | ATS Scorer | — | 8, 9, 17 |
| 11 | Rate Limiter | 7 | — |
| 12 | Frontend SPA & Auth | 4 | — |
| 13 | Frontend CV Form | 12, 6 | — |
| 14 | Frontend CV Upload | 13, 5, 7 | — |
| 15 | Frontend Onboarding | 13, 7 | 16 |
| 16 | Frontend CV Generation | 13, 7 | 15 |
| 17 | CSS Layout & Themes | — | 8, 9, 10 |
| 18 | Frontend ATS Panel | 16, 7 | — |
| 19 | Frontend Editor & Export | 16 | — |
| 20 | Full Stack Test | all above | — |
| 21 | Deploy to Droplet | 20 | — |
