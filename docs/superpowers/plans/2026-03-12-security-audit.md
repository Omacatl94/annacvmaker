# Security Audit — Production Hardening Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the JobHacker SaaS app for public production deployment on `app.jobhacker.it`.

**Architecture:** Incremental hardening across 5 categories — auth, injection, headers, rate limiting, infra. Each category is a separate commit. Two new dependencies (`@fastify/helmet`, `@fastify/rate-limit`) replace custom code. All changes are server-side.

**Tech Stack:** Fastify 5, Node.js 20, PostgreSQL 16, Playwright (PDF), Stripe, JWT (custom), DOMPurify + jsdom

**Spec:** `docs/superpowers/specs/2026-03-12-security-audit-design.md`

---

## Chunk 1: Authentication & Sessions (Spec Section 1)

### Task 1: Add domain config env vars

**Files:**
- Modify: `server/config.js`

- [ ] **Step 1: Add APP_ORIGIN, ALLOWED_ORIGINS, COOKIE_SECURE to config**

```js
// Add after the existing config properties, before the closing };
appOrigin: env('APP_ORIGIN', 'https://app.jobhacker.it'),
allowedOrigins: env('ALLOWED_ORIGINS', '').split(',').filter(Boolean),
cookieSecure: env('COOKIE_SECURE', 'true') === 'true',
```

The `allowedOrigins` getter should fall back to `[appOrigin, 'https://jobhacker.it']` if the env var is empty. Update the property:

```js
allowedOrigins: (() => {
  const raw = env('ALLOWED_ORIGINS', '');
  if (raw) return raw.split(',').map(s => s.trim()).filter(Boolean);
  const origin = env('APP_ORIGIN', 'https://app.jobhacker.it');
  return [origin, 'https://jobhacker.it'];
})(),
cookieSecure: env('COOKIE_SECURE', 'true') === 'true',
```

- [ ] **Step 2: Verify server starts**

Run: `node -e "import('./server/config.js').then(m => console.log(JSON.stringify({appOrigin: m.config.appOrigin, origins: m.config.allowedOrigins, secure: m.config.cookieSecure}, null, 2)))"`
Expected: JSON with defaults printed

- [ ] **Step 3: Commit**

```bash
git add server/config.js
git commit -m "feat(security): add APP_ORIGIN, ALLOWED_ORIGINS, COOKIE_SECURE config"
```

---

### Task 2: Harden JWT with iss/aud claims

**Files:**
- Modify: `server/services/jwt.js`

- [ ] **Step 1: Update `sign()` to include `iss` and `aud`**

In `server/services/jwt.js`, change the `sign` function body. The `payload` object should include `iss` and `aud`:

```js
export function sign(payload, secret, expiresInSeconds = 7 * 24 * 3600) {
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iss: 'jobhacker', aud: 'app.jobhacker.it', iat: now, exp: now + expiresInSeconds };
  const encodedPayload = Buffer.from(JSON.stringify(body)).toString('base64url');
  const data = `${HEADER}.${encodedPayload}`;
  const signature = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${signature}`;
}
```

- [ ] **Step 2: Update `verify()` to check `iss` and `aud`**

After the existing `exp` check, add:

```js
if (decoded.iss !== 'jobhacker' || decoded.aud !== 'app.jobhacker.it') return null;
```

Full updated `verify()`:

```js
export function verify(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, payload, sig] = parts;
  const data = `${header}.${payload}`;
  const expected = createHmac('sha256', secret).update(data).digest('base64url');

  // Timing-safe comparison
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) return null;
    if (decoded.iss !== 'jobhacker' || decoded.aud !== 'app.jobhacker.it') return null;
    return decoded;
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Verify JWT round-trip**

Run: `node -e "import('./server/services/jwt.js').then(({sign,verify}) => { const t = sign({id:1},'testsecret',60); console.log('token:', t); const p = verify(t,'testsecret'); console.log('payload:', p); const bad = sign({id:1},'other',60); console.log('bad secret:', verify(bad,'testsecret')); })"`
Expected: Valid token decoded with `iss: 'jobhacker'`, `aud: 'app.jobhacker.it'`; bad secret returns `null`

- [ ] **Step 4: Commit**

```bash
git add server/services/jwt.js
git commit -m "feat(security): add iss/aud claims to JWT sign/verify"
```

---

### Task 3: Harden auth cookies

**Files:**
- Modify: `server/routes/auth.js`

- [ ] **Step 1: Update cookie name and settings**

In `server/routes/auth.js`, change the constants and `setAuthCookie`. Note: `config` is already imported at line 2 of `auth.js` — do NOT add a duplicate import.

```js
const COOKIE_NAME = '__Host-jh_token';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_AGE_S = 7 * 24 * 3600;

function setAuthCookie(reply, user, guest = false) {
  const token = sign({ id: user.id, guest, role: user.role || 'user' }, config.jwtSecret, MAX_AGE_S);
  reply.setCookie(COOKIE_NAME, token, {
    path: '/',
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    maxAge: MAX_AGE_MS / 1000,
  });
}
```

Note: `__Host-` prefix requires `secure: true` and `path: '/'` with NO `domain` attribute (which is already the case — no `domain` is set).

- [ ] **Step 2: Update the JWT hook in `server/index.js` to use new cookie name**

In `server/index.js`, change:

```js
const token = req.cookies?.jh_token;
```

to:

```js
const token = req.cookies?.['__Host-jh_token'];
```

- [ ] **Step 3: Update `clearAuthCookie` to use new name**

Verify `clearAuthCookie` in `server/routes/auth.js` uses `COOKIE_NAME`:

```js
function clearAuthCookie(reply) {
  reply.clearCookie(COOKIE_NAME, { path: '/' });
}
```

This already references the constant, so it picks up the rename automatically.

- [ ] **Step 4: Commit**

```bash
git add server/routes/auth.js server/index.js
git commit -m "feat(security): harden auth cookie with __Host- prefix and secure flag"
```

---

### Task 4: Add OAuth CSRF state parameter

**Files:**
- Modify: `server/routes/auth.js`
- Modify: `server/services/oauth.js`

- [ ] **Step 1: Add state generation and cookie helpers in auth routes**

At the top of the `authRoutes` function body in `server/routes/auth.js`, add:

```js
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
```

- [ ] **Step 2: Update Google OAuth flow to use state**

Update `oauth.js` `getAuthUrl` to accept a `state` parameter:

```js
getAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: config.google.callbackUrl,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
},
```

Do the same for LinkedIn:

```js
getAuthUrl(state) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.linkedin.clientId,
    redirect_uri: config.linkedin.callbackUrl,
    scope: 'openid profile email',
    state,
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
},
```

- [ ] **Step 3: Update auth routes to generate state and verify on callback**

Google initiation:

```js
app.get('/google', (req, reply) => {
  const state = crypto.randomBytes(32).toString('hex');
  setStateCookie(reply, state);
  reply.redirect(google.getAuthUrl(state));
});
```

Google callback — add `verifyState` and clear cookie:

```js
app.get('/google/callback', async (req, reply) => {
  try {
    verifyState(req);
    reply.clearCookie(STATE_COOKIE, { path: '/api/auth' });
    const { code } = req.query;
    if (!code) throw new Error('No code received');
    const tokens = await google.getToken(code);
    const info = await google.getUserInfo(tokens.access_token);
    const { user, isNew } = await findOrCreateUser({ email: info.email, name: info.name, googleId: info.id });
    auditLog(req, user.id, isNew ? 'register_google' : 'login_google');
    setAuthCookie(reply, user, false);
    return reply.redirect('/');
  } catch (err) {
    req.log.error(err);
    return reply.redirect('/?error=auth_failed');
  }
});
```

LinkedIn initiation:

```js
app.get('/linkedin', (req, reply) => {
  const state = crypto.randomBytes(32).toString('hex');
  setStateCookie(reply, state);
  reply.redirect(linkedin.getAuthUrl(state));
});
```

LinkedIn callback:

```js
app.get('/linkedin/callback', async (req, reply) => {
  try {
    verifyState(req);
    reply.clearCookie(STATE_COOKIE, { path: '/api/auth' });
    const { code } = req.query;
    if (!code) throw new Error('No code received');
    const tokens = await linkedin.getToken(code);
    const info = await linkedin.getUserInfo(tokens.access_token);
    const { user, isNew } = await findOrCreateUser({ email: info.email, name: info.name, linkedinId: info.sub });
    auditLog(req, user.id, isNew ? 'register_linkedin' : 'login_linkedin');
    setAuthCookie(reply, user, false);
    return reply.redirect('/');
  } catch (err) {
    req.log.error(err);
    return reply.redirect('/?error=auth_failed');
  }
});
```

- [ ] **Step 4: Commit**

```bash
git add server/routes/auth.js server/services/oauth.js
git commit -m "feat(security): add OAuth CSRF state parameter for Google and LinkedIn"
```

---

## Chunk 2: Injection & SSRF (Spec Section 2)

### Task 5: Create safePath utility for path traversal prevention

**Files:**
- Create: `server/utils/safe-path.js`

- [ ] **Step 1: Create the utility**

```js
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOADS_BASE = resolve(join(__dirname, '../..', 'uploads'));

/**
 * Validates that a file path resolves to within the uploads directory.
 * Returns the resolved absolute path, or throws if path escapes uploads.
 */
export function safePath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    const err = new Error('Invalid file path');
    err.statusCode = 400;
    throw err;
  }

  // Strip leading slash or "uploads/" prefix for normalization
  const cleaned = filePath.replace(/^\/?(uploads\/)?/, '');
  const resolved = resolve(UPLOADS_BASE, cleaned);

  if (!resolved.startsWith(UPLOADS_BASE)) {
    const err = new Error('Path traversal blocked');
    err.statusCode = 403;
    throw err;
  }

  return resolved;
}

export { UPLOADS_BASE };
```

- [ ] **Step 2: Verify safe path works**

Run: `node -e "import('./server/utils/safe-path.js').then(({safePath}) => { console.log(safePath('cvs/test.pdf')); try { safePath('../../etc/passwd') } catch(e) { console.log('BLOCKED:', e.message) } })"`
Expected: Absolute path for valid file, "BLOCKED: Path traversal blocked" for traversal attempt

- [ ] **Step 3: Commit**

```bash
git add server/utils/safe-path.js
git commit -m "feat(security): add safePath utility for path traversal prevention"
```

---

### Task 6: Fix path traversal in AI parse-cv route

**Files:**
- Modify: `server/routes/ai.js`
- Modify: `server/services/openrouter.js`

- [ ] **Step 1: Update parse-cv route to validate filePath**

In `server/routes/ai.js`, add import at top:

```js
import { safePath } from '../utils/safe-path.js';
```

Update the `parse-cv` handler to validate and pass absolute path:

```js
app.post('/parse-cv', { preHandler: aiHeavyLimit }, async (req, reply) => {
  const { filePath } = req.body;
  if (!filePath) return reply.code(400).send({ error: 'filePath required' });

  const absPath = safePath(filePath);
  const rawText = await openrouter.parseDocument(absPath);
  // ... rest unchanged
```

- [ ] **Step 2: Update openrouter.parseDocument to accept absolute path directly**

In `server/services/openrouter.js`, change `parseDocument` to accept an absolute path instead of resolving it:

```js
async function parseDocument(absPath) {
  const fileBuffer = readFileSync(absPath);
  const base64 = fileBuffer.toString('base64');
  const ext = absPath.split('.').pop().toLowerCase();
  // ... rest unchanged
```

Remove the `join(__dirname, '../..', filePath)` line — the path is already absolute and validated.

- [ ] **Step 3: Commit**

```bash
git add server/routes/ai.js server/services/openrouter.js
git commit -m "fix(security): prevent path traversal in CV parsing"
```

---

### Task 7: Fix SQL column interpolation in admin routes

**Files:**
- Modify: `server/routes/admin.js`

- [ ] **Step 1: Replace string interpolation with safe column mapping**

In the `/users` GET handler in `server/routes/admin.js`, replace the current sort logic:

```js
const sortCol = ['created_at', 'email', 'name', 'credits'].includes(sort) ? sort : 'created_at';
const sortDir = order === 'asc' ? 'ASC' : 'DESC';
```

and the query interpolation `ORDER BY u.${sortCol} ${sortDir}` with:

```js
const SORT_COLUMNS = {
  created_at: 'u.created_at',
  email: 'u.email',
  name: 'u.name',
  credits: 'u.credits',
};
const sortExpr = SORT_COLUMNS[sort] || 'u.created_at';
const sortDir = order === 'asc' ? 'ASC' : 'DESC';
```

And in the query:

```sql
ORDER BY ${sortExpr} ${sortDir}
```

The values come from the constant map, never from user input.

- [ ] **Step 2: Commit**

```bash
git add server/routes/admin.js
git commit -m "fix(security): use safe column mapping for admin user sorting"
```

---

### Task 8: Fix Content-Disposition header injection

**Files:**
- Modify: `server/routes/cv.js`

- [ ] **Step 1: Sanitize filename in export-pdf route**

In `server/routes/cv.js`, in the `export-pdf` handler, replace:

```js
.header('Content-Disposition', `attachment; filename="${filename || 'cv.pdf'}"`)
```

with:

```js
.header('Content-Disposition', `attachment; filename="${(filename || 'cv').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 100)}.pdf"`)
```

This strips all non-alphanumeric chars (except `-` and `_`), limits to 100 chars, and always appends `.pdf`.

- [ ] **Step 2: Commit**

```bash
git add server/routes/cv.js
git commit -m "fix(security): sanitize Content-Disposition filename to prevent header injection"
```

---

### Task 9: Fix SSRF in PDF export

**Files:**
- Modify: `server/services/pdf-export.js`

- [ ] **Step 1: Add DOMPurify server-side sanitization**

In `server/services/pdf-export.js`, add imports at top:

```js
import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';
```

Create a sanitizer instance:

```js
const window = new JSDOM('').window;
const purify = DOMPurify(window);
```

- [ ] **Step 2: Add HTML sanitization before Chromium rendering**

At the start of `generatePDF`, before the existing `cleanHtml` logic:

```js
export async function generatePDF(html) {
  // Sanitize HTML — allow layout/text tags, block script/iframe/object/embed/form
  const sanitized = purify.sanitize(html, {
    ALLOWED_TAGS: [
      'html', 'head', 'body', 'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'strong', 'em', 'b', 'i', 'u', 'br', 'hr', 'a', 'img',
      'section', 'article', 'header', 'footer', 'nav', 'main',
      'style', 'link', 'title',
    ],
    ALLOWED_ATTR: [
      'class', 'id', 'style', 'href', 'src', 'alt', 'width', 'height',
      'colspan', 'rowspan', 'rel', 'type', 'content', 'name', 'charset',
    ],
    ALLOW_DATA_ATTR: false,
  });

  // Strip external resource links (Google Fonts etc.) to avoid network waits
  let cleanHtml = sanitized.replace(/<link[^>]*href="https?:\/\/[^"]*"[^>]*>/gi, '');

  // Inject <base> so Chromium resolves relative URLs against local server
  cleanHtml = cleanHtml.replace('<head>', `<head><base href="${LOCAL_ORIGIN}/">`);

  // ... rest of function unchanged
```

- [ ] **Step 3: Add Chromium network isolation args**

Update the `chromium.launch` call to block outbound network requests:

```js
const browser = await chromium.launch({
  executablePath: CHROMIUM_PATH,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE localhost',
  ],
});
```

This makes Chromium resolve all hostnames to `NOTFOUND` except `localhost`, preventing SSRF to internal services or cloud metadata endpoints.

- [ ] **Step 4: Commit**

```bash
git add server/services/pdf-export.js
git commit -m "fix(security): sanitize HTML and isolate Chromium network in PDF export"
```

---

## Chunk 3: CORS, Headers & Transport (Spec Section 3)

### Task 10: Install @fastify/helmet

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install dependency**

Run: `npm install @fastify/helmet`

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @fastify/helmet dependency"
```

---

### Task 11: Configure CORS whitelist

**Files:**
- Modify: `server/plugins/cors.js`

- [ ] **Step 1: Replace permissive CORS with whitelist**

Rewrite `server/plugins/cors.js`:

```js
import cors from '@fastify/cors';
import { config } from '../config.js';

export async function registerCors(app) {
  await app.register(cors, {
    origin: config.allowedOrigins,
    credentials: true,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add server/plugins/cors.js
git commit -m "fix(security): replace permissive CORS with origin whitelist"
```

---

### Task 12: Register Helmet with security headers

**Files:**
- Modify: `server/index.js`

- [ ] **Step 1: Add helmet import and registration**

In `server/index.js`, add import:

```js
import helmet from '@fastify/helmet';
```

After the `registerCors` line, add:

```js
await app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  hsts: {
    maxAge: 63072000,
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permissionsPolicy: {
    features: {
      camera: [],
      microphone: [],
      geolocation: [],
    },
  },
});
```

Note: Helmet applies globally to all routes. The Stripe webhook is server-to-server, so extra security headers are harmless — Stripe ignores them. No per-route exception needed.

- [ ] **Step 2: Commit**

```bash
git add server/index.js
git commit -m "feat(security): add security headers via @fastify/helmet"
```

---

### Task 13: Centralize APP_ORIGIN in Stripe and PDF

**Files:**
- Modify: `server/routes/payments.js`
- Modify: `server/services/pdf-export.js`

- [ ] **Step 1: Update Stripe checkout URLs**

In `server/routes/payments.js`, add import:

```js
import { config } from '../config.js';
```

(May already be imported — check first.)

Replace:

```js
success_url: `${req.headers.origin || 'https://jobhacker.it'}/#payment-success`,
cancel_url: `${req.headers.origin || 'https://jobhacker.it'}/#payment-cancel`,
```

with:

```js
success_url: `${config.appOrigin}/#payment-success`,
cancel_url: `${config.appOrigin}/#payment-cancel`,
```

Note: `LOCAL_ORIGIN` in `server/services/pdf-export.js` stays as `http://localhost:...` — Chromium connects locally inside the container. `APP_ORIGIN` is for external-facing URLs only (Stripe, CORS). No change needed for pdf-export.js.

- [ ] **Step 2: Commit**

```bash
git add server/routes/payments.js
git commit -m "feat(security): centralize APP_ORIGIN for Stripe redirect URLs"
```

---

## Chunk 4: Rate Limiting & Input Validation (Spec Section 4)

### Task 14: Install @fastify/rate-limit and configure global limit

**Files:**
- Modify: `package.json`
- Modify: `server/index.js`

- [ ] **Step 1: Install dependency**

Run: `npm install @fastify/rate-limit`

- [ ] **Step 2: Register global rate limit in index.js**

In `server/index.js`, add import:

```js
import rateLimit from '@fastify/rate-limit';
```

After the helmet registration, add:

```js
await app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  keyGenerator: (req) => req.user?.id?.toString() || req.ip,
});
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json server/index.js
git commit -m "feat(security): add @fastify/rate-limit with global 100/min limit"
```

---

### Task 15: Add per-route rate limits and remove old rate limiter

**Files:**
- Modify: `server/routes/ai.js`
- Modify: `server/routes/auth.js`
- Modify: `server/routes/upload.js`
- Modify: `server/routes/admin.js`
- Delete: `server/middleware/rate-limit.js`

- [ ] **Step 1: Update AI routes to use per-route config**

In `server/routes/ai.js`, remove the imports:

```js
// REMOVE these lines:
import { rateLimit } from '../middleware/rate-limit.js';

const aiHeavyLimit = rateLimit({ windowMs: 60000, max: 5 });
const aiLightLimit = rateLimit({ windowMs: 60000, max: 15 });
```

Replace `{ preHandler: aiHeavyLimit }` with Fastify rate limit config:

```js
const AI_HEAVY = { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } };
const AI_LIGHT = { config: { rateLimit: { max: 15, timeWindow: '1 minute' } } };
```

Update EVERY route that used `aiHeavyLimit` or `aiLightLimit`. Complete list:

**AI_HEAVY routes (was `preHandler: aiHeavyLimit`):**
```js
app.post('/parse-cv', AI_HEAVY, async (req, reply) => { ...
app.post('/analyze', AI_HEAVY, async (req, reply) => { ...
app.post('/optimize', AI_HEAVY, async (req, reply) => { ...
```

**AI_HEAVY routes with creditGuard (was `preHandler: [aiHeavyLimit, creditGuard(...)]`):**
```js
app.post('/generate', {
  config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  preHandler: [creditGuard('cv_generation')],
}, async (req, reply) => { ...

app.post('/cover-letter', {
  config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  preHandler: [creditGuard('cover_letter')],
}, async (req, reply) => { ...
```

**AI_LIGHT routes (was `preHandler: aiLightLimit`):**
```js
app.post('/fit-score', AI_LIGHT, async (req, reply) => { ...
app.post('/extract-keywords', AI_LIGHT, async (req, reply) => { ...
app.post('/ats-score', AI_LIGHT, async (req, reply) => { ...
```

That's 8 routes total — ALL of them must be updated before the old imports are removed.

- [ ] **Step 2: Add rate limits to auth routes**

In `server/routes/auth.js`, add rate limit config to the guest endpoint:

```js
app.post('/guest', {
  config: { rateLimit: { max: 3, timeWindow: '1 minute' } },
}, async (req, reply) => { ...
```

Add a general auth rate limit to the OAuth initiation routes:

```js
app.get('/google', {
  config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
}, (req, reply) => { ...

app.get('/linkedin', {
  config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
}, (req, reply) => { ...
```

- [ ] **Step 3: Add rate limits to upload routes**

In `server/routes/upload.js`, add to each route:

```js
app.post('/photo', {
  config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
}, async (req, reply) => { ...

app.post('/cv-file', {
  config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
}, async (req, reply) => { ...
```

- [ ] **Step 4: Delete old rate limiter**

Run: `rm server/middleware/rate-limit.js`

Verify no other file imports it:

Run: `grep -r "rate-limit" server/ --include="*.js"`

Should only show references in node_modules, not in server code.

- [ ] **Step 5: Commit**

```bash
git add server/routes/ai.js server/routes/auth.js server/routes/upload.js
git rm server/middleware/rate-limit.js
git commit -m "feat(security): migrate to @fastify/rate-limit with per-route limits"
```

---

### Task 16: Add input validation schemas to critical routes

**Files:**
- Modify: `server/routes/ai.js`
- Modify: `server/routes/cv.js`
- Modify: `server/routes/auth.js`
- Modify: `server/routes/payments.js`

- [ ] **Step 1: Add schema to AI generate route**

In `server/routes/ai.js`, update the `/generate` route to include a schema:

```js
app.post('/generate', {
  config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  preHandler: [creditGuard('cv_generation')],
  schema: {
    body: {
      type: 'object',
      required: ['profile', 'jobDescription'],
      properties: {
        profile: { type: 'object' },
        jobDescription: { type: 'string', maxLength: 10000 },
        language: { type: 'string', maxLength: 10 },
        targetKeywords: {},
      },
    },
  },
}, async (req, reply) => { ...
```

- [ ] **Step 2: Add schema to CV export-pdf route**

In `server/routes/cv.js`:

```js
app.post('/export-pdf', {
  schema: {
    body: {
      type: 'object',
      required: ['html'],
      properties: {
        html: { type: 'string', maxLength: 512000 },
        filename: { type: 'string', maxLength: 120, pattern: '^[a-zA-Z0-9_ -]*$' },
      },
    },
  },
}, async (req, reply) => { ...
```

- [ ] **Step 3: Add schema to auth PUT /me**

In `server/routes/auth.js`:

```js
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
}, async (req, reply) => { ...
```

- [ ] **Step 4: Add schema to payments create-checkout**

In `server/routes/payments.js`:

```js
app.post('/create-checkout', {
  preHandler: authGuard,
  schema: {
    body: {
      type: 'object',
      required: ['tier'],
      properties: {
        tier: { type: 'string', enum: Object.keys(PRICING_TIERS) },
      },
    },
  },
}, async (req, reply) => { ...
```

- [ ] **Step 5: Commit**

```bash
git add server/routes/ai.js server/routes/cv.js server/routes/auth.js server/routes/payments.js
git commit -m "feat(security): add JSON Schema input validation to critical routes"
```

---

### Task 17: Add upload magic bytes validation

**Files:**
- Modify: `server/routes/upload.js`

- [ ] **Step 1: Add magic bytes checker**

At the top of `server/routes/upload.js`, add:

```js
const MAGIC_BYTES = {
  'image/jpeg': [Buffer.from([0xFF, 0xD8, 0xFF])],
  'image/png': [Buffer.from([0x89, 0x50, 0x4E, 0x47])],
  'image/webp': [Buffer.from('RIFF')], // RIFF header, WebP follows at offset 8
  'application/pdf': [Buffer.from('%PDF')],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [Buffer.from([0x50, 0x4B, 0x03, 0x04])],
};

function validateMagicBytes(buffer, mimetype) {
  const expected = MAGIC_BYTES[mimetype];
  if (!expected) return true; // unknown type, skip check
  return expected.some(magic => buffer.subarray(0, magic.length).equals(magic));
}
```

- [ ] **Step 2: Collect file buffer and validate in upload handlers**

The current handlers use `pipeline(file.file, createWriteStream(dest))` which streams directly to disk. To check magic bytes, we need to buffer the file.

First, update the static import at the top of the file — add `writeFileSync` to the existing import:

```js
import { createWriteStream, mkdirSync, writeFileSync } from 'fs';
```

Remove the `pipeline` import since we no longer need it:

```js
// REMOVE: import { pipeline } from 'stream/promises';
```

Update `/photo` handler:

```js
app.post('/photo', {
  config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
}, async (req, reply) => {
  const file = await req.file();
  if (!file) return reply.code(400).send({ error: 'No file uploaded' });
  if (!ALLOWED_PHOTO_TYPES.includes(file.mimetype)) {
    return reply.code(400).send({ error: 'Invalid file type. Use JPEG, PNG, or WebP.' });
  }

  // Buffer file to check magic bytes
  const chunks = [];
  for await (const chunk of file.file) { chunks.push(chunk); }
  const buffer = Buffer.concat(chunks);

  if (!validateMagicBytes(buffer, file.mimetype)) {
    return reply.code(400).send({ error: 'File content does not match declared type' });
  }

  const ext = extname(file.filename) || '.jpg';
  const name = `${randomUUID()}${ext}`;
  const dest = join(uploadsBase, 'photos', name);
  writeFileSync(dest, buffer);
  reply.send({ path: `/uploads/photos/${name}` });
});
```

Update `/cv-file` handler:

```js
app.post('/cv-file', {
  config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
}, async (req, reply) => {
  const file = await req.file();
  if (!file) return reply.code(400).send({ error: 'No file uploaded' });
  if (!ALLOWED_CV_TYPES.includes(file.mimetype)) {
    return reply.code(400).send({ error: 'Invalid file type. Use PDF, DOCX, JPEG, or PNG.' });
  }

  // Buffer file to check magic bytes
  const chunks = [];
  for await (const chunk of file.file) { chunks.push(chunk); }
  const buffer = Buffer.concat(chunks);

  if (!validateMagicBytes(buffer, file.mimetype)) {
    return reply.code(400).send({ error: 'File content does not match declared type' });
  }

  const ext = extname(file.filename) || '.pdf';
  const name = `${randomUUID()}${ext}`;
  const dest = join(uploadsBase, 'cvs', name);
  writeFileSync(dest, buffer);
  reply.send({ path: `/uploads/cvs/${name}`, filename: file.filename });
});
```

- [ ] **Step 3: Commit**

```bash
git add server/routes/upload.js
git commit -m "feat(security): add magic bytes validation for file uploads"
```

---

## Chunk 5: Dockerfile, Error Handling & Cleanup (Spec Section 5)

### Task 18: Harden Dockerfile

**Files:**
- Modify: `Dockerfile`

- [ ] **Step 1: Update Dockerfile with non-root user and proper ownership**

```dockerfile
FROM node:20-alpine

# Chromium + fonts for server-side PDF generation
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates \
    ttf-freefont font-noto font-noto-emoji

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV CHROMIUM_PATH=/usr/bin/chromium-browser

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

COPY --chown=node:node . .
RUN mkdir -p uploads/photos uploads/cvs && chown -R node:node uploads

USER node
EXPOSE 3000
CMD ["sh", "-c", "node server/db/migrate.js && node server/index.js"]
```

- [ ] **Step 2: Commit**

```bash
git add Dockerfile
git commit -m "fix(security): run Docker container as non-root user"
```

---

### Task 19: Harden error responses

**Files:**
- Modify: `server/index.js`
- Modify: `server/routes/ai.js`

- [ ] **Step 1: Remove error detail leaking in error handler**

In `server/index.js`, replace the 5xx response block:

```js
if (statusCode >= 500) {
  reply.code(statusCode).send({
    error: 'Errore interno. Riprova tra qualche secondo.',
    ...(process.env.NODE_ENV !== 'production' && { detail: error.message }),
  });
}
```

with:

```js
if (statusCode >= 500) {
  reply.code(statusCode).send({
    error: 'Errore interno. Riprova tra qualche secondo.',
  });
}
```

- [ ] **Step 2: Remove `raw` field from AI 422 responses**

In `server/routes/ai.js`, find all occurrences of:

```js
reply.code(422).send({ error: '...', raw: result });
```

and:

```js
reply.code(422).send({ error: '...', raw: rawText });
```

Remove the `raw` field from each. Example:

```js
// Before:
reply.code(422).send({ error: 'Failed to parse CV structure', raw: rawText });

// After:
reply.code(422).send({ error: 'Failed to parse CV structure' });
```

Do this for ALL 422 error responses in `ai.js` (there are 8 of them: parse-cv, analyze, fit-score, extract-keywords, generate, ats-score, optimize, cover-letter).

**IMPORTANT:** The `/parse-cv` SUCCESS response (line ~49) has `reply.send({ raw: rawText, structured: parsed })` — this `raw` field is intentional (returns parsed text to the frontend). Do NOT remove `raw` from success responses, only from 422 error responses.

- [ ] **Step 3: Commit**

```bash
git add server/index.js server/routes/ai.js
git commit -m "fix(security): remove error detail and raw LLM output leaking to client"
```

---

### Task 20: Eliminate dev-login in production and add audit logs

**Files:**
- Modify: `server/routes/auth.js`

- [ ] **Step 1: Conditionally register dev-login route**

In `server/routes/auth.js`, replace:

```js
app.post('/dev-login', async (req, reply) => {
  if (process.env.NODE_ENV === 'production') return reply.code(404).send({ error: 'Not found' });
  const { email, name } = req.body || {};
  if (!email) return reply.code(400).send({ error: 'email required' });
  const { user } = await findOrCreateUser({ email, name: name || 'Test User' });
  setAuthCookie(reply, user, false);
  reply.send({ user: { id: user.id, email: user.email, name: user.name } });
});
```

with:

```js
if (process.env.NODE_ENV === 'development') {
  app.post('/dev-login', async (req, reply) => {
    const { email, name } = req.body || {};
    if (!email) return reply.code(400).send({ error: 'email required' });
    const { user } = await findOrCreateUser({ email, name: name || 'Test User' });
    setAuthCookie(reply, user, false);
    reply.send({ user: { id: user.id, email: user.email, name: user.name } });
  });
}
```

- [ ] **Step 2: Add audit logs for GDPR export and account deletion**

In the `/me/export` handler, add after the auth check:

```js
auditLog(req, req.user.id, 'gdpr_export');
```

In the `DELETE /me` handler, add before the delete query:

```js
auditLog(req, req.user.id, 'account_delete');
```

- [ ] **Step 3: Add audit log for failed OAuth attempts**

In both Google and LinkedIn callback catch blocks, add:

```js
catch (err) {
  req.log.error(err);
  auditLog(req, null, 'oauth_failed', { provider: 'google', error: err.message?.substring(0, 200) });
  return reply.redirect('/?error=auth_failed');
}
```

(Use `'linkedin'` for the LinkedIn callback.)

- [ ] **Step 4: Commit**

```bash
git add server/routes/auth.js
git commit -m "feat(security): eliminate dev-login in prod, add audit logs for GDPR/delete/oauth failures"
```

---

### Task 21: Add PostgreSQL SSL in production

**Files:**
- Modify: `server/config.js`

- [ ] **Step 1: Add SSL config to database settings**

In `server/config.js`, update the `db` block:

```js
db: {
  host: env('DB_HOST', 'localhost'),
  port: parseInt(env('DB_PORT', '5432')),
  database: env('DB_NAME', 'cvmaker'),
  user: env('DB_USER', 'cvmaker'),
  password: env('DB_PASSWORD'),
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
},
```

- [ ] **Step 2: Commit**

```bash
git add server/config.js
git commit -m "feat(security): enable PostgreSQL SSL in production"
```

---

### Task 22: Final verification

- [ ] **Step 1: Verify server starts without errors in dev mode**

Run: `cd /Users/paolodiana/Documents/Job\ Hacker && timeout 5 node server/index.js 2>&1 || true`

Check for startup errors. The server may fail to connect to DB (expected if DB isn't running), but should not crash on import/config errors.

- [ ] **Step 2: Verify no remaining references to old rate limiter**

Run: `grep -r "middleware/rate-limit" server/ --include="*.js"`

Expected: No matches.

- [ ] **Step 3: Verify no `raw:` in 422 responses**

Run: `grep -n "raw:" server/routes/ai.js`

Expected: No matches in `reply.send()` calls.

- [ ] **Step 4: Final commit summary**

Run: `git log --oneline -20`

Verify all security commits are present and well-ordered.
