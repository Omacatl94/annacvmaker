# Security Audit — Production Hardening

**Date:** 2026-03-12
**Target:** JobHacker SaaS (app.jobhacker.it)
**Approach:** B — Hardening + targeted dependencies (@fastify/helmet, @fastify/rate-limit)
**Deployment:** Incremental by category, separate commits

## Threat Model

Public SaaS on the internet. Anonymous users, automated attacks, bots. Must resist OWASP Top 10.

Domain split:
- `jobhacker.it` — landing page / marketing
- `app.jobhacker.it` — application (all API routes, auth, uploads)

---

## Section 1: Authentication & Sessions

### 1.1 OAuth `state` parameter
- Generate a random nonce (`crypto.randomBytes(32).toString('hex')`)
- Store in a short-lived cookie (`jh_oauth_state`, 10 min TTL, httpOnly, secure, sameSite=lax)
- Pass as `state` query param to Google/LinkedIn auth URL
- On callback: verify `req.query.state === req.cookies.jh_oauth_state`; reject if mismatch
- Clear the state cookie after verification

### 1.2 Cookie hardening
- Rename `jh_token` → `__Host-jh_token`
  - Requires: `secure: true`, `path: '/'`, NO `domain` attribute
  - Prevents cookie injection from subdomains
- `sameSite: 'strict'` (was `lax`)
- `secure: true` always (dev uses a separate bypass flag, not weakened cookies)
- New env var `COOKIE_SECURE=true` (default), set to `false` only for local dev

### 1.3 JWT claims
- Add `iss: 'jobhacker'` and `aud: 'app.jobhacker.it'` to JWT payload in `sign()`
- Verify both claims in `verify()` — reject tokens with wrong issuer/audience
- Prevents token confusion across services

### 1.4 Domain configuration
- New env var `APP_ORIGIN=https://app.jobhacker.it`
- Used for: CORS whitelist, OAuth callback URLs, Stripe redirect URLs, PDF `<base href>`

**Files modified:** `server/services/jwt.js`, `server/routes/auth.js`, `server/services/oauth.js`, `server/config.js`

---

## Section 2: Injection & SSRF

### 2.1 SQL injection in admin `/users`
- **Current:** `ORDER BY u.${sortCol} ${sortDir}` — string interpolation in SQL
- **Fix:** Object mapping `{ created_at: 'u.created_at', email: 'u.email', ... }` → lookup column from map, never interpolate user input

### 2.2 Path traversal in `/api/ai/parse-cv`
- **Current:** `filePath` from request body passed to `readFileSync(join(__dirname, '../..', filePath))`
- **Fix:** Resolve to absolute path, then `startsWith` check against `uploads/` directory
- Reject any path containing `..` or that resolves outside uploads

### 2.3 Path traversal in `openrouter.parseDocument`
- Same issue as 2.2 — `filePath` used in `readFileSync(absPath)` without validation
- Same fix: validate resolved path is within `uploads/`

### 2.4 SSRF via PDF export
- **Current:** Arbitrary HTML passed to Chromium for rendering
- **Fix (defense in depth):**
  1. Sanitize HTML with DOMPurify (already a dependency) before passing to Chromium
     - Remove `<script>`, `<iframe>`, `<object>`, `<embed>`, `<form>`, `<meta>` tags
     - Allow only: standard text/layout tags, `<img>` with `src` matching local origin or `data:` URIs
  2. Chromium launch args: add `--host-resolver-rules="MAP * ~NOTFOUND, EXCLUDE localhost"` to block outbound requests to internal IPs
     - Override to allow only LOCAL_ORIGIN
  3. Strip any `<link>` with external `href` (already partially done)

**Files modified:** `server/routes/admin.js`, `server/routes/ai.js`, `server/services/openrouter.js`, `server/services/pdf-export.js`

---

## Section 3: CORS, Headers & Transport Security

### 3.1 CORS whitelist
- **Current:** `origin: true` (reflects any origin)
- **Fix:** Explicit whitelist from `ALLOWED_ORIGINS` env var
  - Production default: `https://app.jobhacker.it,https://jobhacker.it`
  - Dev: `http://localhost:3000`
- Credentials: `true` (needed for cookie auth)

### 3.2 Security headers via @fastify/helmet
New dependency: `@fastify/helmet`

Headers set:
- `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `X-Powered-By` removed

### 3.3 Stripe webhook exception
- `/api/payments/webhook` is server-to-server — CSP headers not needed
- Register helmet globally but skip for webhook route

### 3.4 APP_ORIGIN centralized
- Single env var `APP_ORIGIN` drives: CORS, cookie scope, Stripe success/cancel URLs, PDF `<base href>`
- Replaces `req.headers.origin` fallbacks in payments route

**Files modified:** `server/plugins/cors.js`, `server/index.js`, `server/config.js`, `server/routes/payments.js`
**New dependency:** `@fastify/helmet`

---

## Section 4: Rate Limiting & Input Validation

### 4.1 Rate limiter replacement
- **Current:** Custom in-memory Map, leaks memory, no Retry-After header, resets on restart
- **New:** `@fastify/rate-limit` with in-memory store (swappable to Redis later)
- Remove `server/middleware/rate-limit.js`

Rate limits:
| Scope | Max | Window |
|-------|-----|--------|
| Global | 100 | 1 min |
| Auth (`/api/auth/*`) | 10 | 1 min |
| AI heavy (generate, optimize, cover-letter, parse-cv, analyze) | 5 | 1 min |
| AI light (ats-score, fit-score, extract-keywords) | 15 | 1 min |
| Upload | 10 | 1 min |
| Admin | 30 | 1 min |

Key: `req.user?.id || req.ip`
Response: 429 with `Retry-After` header

### 4.2 Input validation via Fastify JSON Schema
Add `schema` option to critical routes:

- `POST /api/ai/generate` — `profile`: object required, `jobDescription`: string max 10000 chars
- `POST /api/cv/export-pdf` — `html`: string max 500KB, `filename`: string pattern `^[a-zA-Z0-9_-]+\.pdf$`
- `PUT /api/auth/me` — `name`: string max 200, `phone`: string max 30, `location`: string max 200
- `POST /api/payments/create-checkout` — `tier`: enum of valid tier keys

### 4.3 Upload magic bytes validation
After MIME type check, read first 8 bytes and verify magic bytes:
- PDF: `%PDF` (0x25504446)
- JPEG: `FFD8FF`
- PNG: `89504E47`
- DOCX: `504B0304` (ZIP header)

Reject if magic bytes don't match declared MIME type.

**Files modified:** `server/routes/ai.js`, `server/routes/cv.js`, `server/routes/auth.js`, `server/routes/payments.js`, `server/routes/upload.js`
**File deleted:** `server/middleware/rate-limit.js`
**New dependency:** `@fastify/rate-limit`

---

## Section 5: Dockerfile, Error Handling & Cleanup

### 5.1 Dockerfile hardening
- Add `USER node` after npm install
- `COPY --chown=node:node . .`
- `RUN mkdir -p uploads/photos uploads/cvs` with correct ownership

### 5.2 Error response hardening
- Remove `detail: error.message` from 5xx responses entirely (no env check — never expose)
- Remove `raw: result` from 422 AI parse failure responses — log server-side only
- Error handler: generic message for all 5xx, specific message for 4xx (already done)

### 5.3 Dev-login elimination in production
- **Current:** Route exists but returns 404 in production
- **Fix:** Conditionally register the route only when `NODE_ENV === 'development'`
- Route doesn't exist at all in production (no 404, no fingerprinting)

### 5.4 Audit log completeness
Add audit log entries for:
- Failed OAuth attempts (in catch blocks of callbacks)
- GDPR data export (`GET /api/auth/me/export`)
- Account deletion (`DELETE /api/auth/me`)

### 5.5 PostgreSQL SSL
- Add `ssl` config: `{ rejectUnauthorized: true }` when `NODE_ENV === 'production'`
- Prevents MITM on database connections

**Files modified:** `Dockerfile`, `server/index.js`, `server/routes/auth.js`, `server/routes/ai.js`, `server/db/connection.js`, `server/config.js`

---

## New Dependencies

| Package | Purpose | Size |
|---------|---------|------|
| `@fastify/helmet` | Security headers (CSP, HSTS, etc.) | ~15KB |
| `@fastify/rate-limit` | Production-grade rate limiting | ~12KB |

## Env Vars Added

| Var | Default | Purpose |
|-----|---------|---------|
| `APP_ORIGIN` | `https://app.jobhacker.it` | Central origin for CORS, cookies, redirects |
| `ALLOWED_ORIGINS` | `APP_ORIGIN,https://jobhacker.it` | CORS whitelist |
| `COOKIE_SECURE` | `true` | Cookie secure flag (false for local dev) |

## Implementation Order

1. Auth & Sessions (section 1)
2. Injection & SSRF (section 2)
3. CORS & Headers (section 3)
4. Rate Limiting & Validation (section 4)
5. Dockerfile & Cleanup (section 5)
