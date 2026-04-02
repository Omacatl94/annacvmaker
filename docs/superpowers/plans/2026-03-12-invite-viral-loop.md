# Invite-Only Viral Loop Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add invite-only gate with viral referral loop — each user gets 6 invite codes max, earns credits when invitees activate, WhatsApp sharing, waitlist for uninvited users.

**Architecture:** New `invite_codes` and `waitlist` tables. New `server/services/invites.js` handles all invite logic. Auth flow modified to gate on invite codes. AI generation route triggers activation rewards. Frontend invite section replaces old referral UI.

**Tech Stack:** Fastify 5, PostgreSQL, vanilla JS frontend, `wa.me` for WhatsApp sharing.

**Spec:** `docs/superpowers/specs/2026-03-12-invite-viral-loop-design.md`

---

## Chunk 1: Backend Foundation

### Task 1: Database Migration

**Files:**
- Create: `server/db/migrations/008-invite-system.sql`

This migration creates the `invite_codes` and `waitlist` tables, adds columns to `users`, and bootstraps existing users with invite codes.

- [ ] **Step 1: Create the migration file**

```sql
-- 008-invite-system.sql
-- Invite-only viral loop: codes, waitlist, user status

-- 1. New tables
CREATE TABLE IF NOT EXISTS invite_codes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  code          VARCHAR(8) NOT NULL UNIQUE,
  batch         INTEGER NOT NULL DEFAULT 1,
  claimed_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  activated     BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMP DEFAULT NOW(),
  claimed_at    TIMESTAMP,
  activated_at  TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invite_codes_owner ON invite_codes (owner_id);

CREATE TABLE IF NOT EXISTS waitlist (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       VARCHAR(255) NOT NULL UNIQUE,
  created_at  TIMESTAMP DEFAULT NOW(),
  invited_at  TIMESTAMP
);

-- 2. Users table changes
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_batch INTEGER NOT NULL DEFAULT 0;

-- 3. Bootstrap: generate 3 invite codes for all existing active users
-- Uses MD5 of random + user id to generate unique 8-char codes
DO $$
DECLARE
  u RECORD;
  i INTEGER;
  new_code VARCHAR(8);
BEGIN
  FOR u IN SELECT id FROM users WHERE status = 'active' AND invite_batch = 0 AND email NOT LIKE '%@anonymous' LOOP
    FOR i IN 1..3 LOOP
      new_code := UPPER(SUBSTR(MD5(RANDOM()::TEXT || u.id::TEXT || i::TEXT), 1, 8));
      -- Handle unlikely collision by retrying
      LOOP
        BEGIN
          INSERT INTO invite_codes (owner_id, code, batch) VALUES (u.id, new_code, 1);
          EXIT;
        EXCEPTION WHEN unique_violation THEN
          new_code := UPPER(SUBSTR(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT), 1, 8));
        END;
      END LOOP;
    END LOOP;
    UPDATE users SET invite_batch = 1 WHERE id = u.id;
  END LOOP;
END $$;
```

- [ ] **Step 2: Test migration locally**

Run: `docker exec -i $(docker ps -q -f name=postgres) psql -U cvmaker -d cvmaker < server/db/migrations/008-invite-system.sql`

Expected: Tables created, existing users get 3 invite codes each.

Verify: `docker exec -i $(docker ps -q -f name=postgres) psql -U cvmaker -d cvmaker -c "SELECT COUNT(*) FROM invite_codes;"`

- [ ] **Step 3: Commit**

```bash
git add server/db/migrations/008-invite-system.sql
git commit -m "feat: add invite system migration (tables + bootstrap)"
```

---

### Task 2: Config — Add inviteOnly Flag

**Files:**
- Modify: `server/config.js:60` (after `openBetaDailyLimit`)

- [ ] **Step 1: Add inviteOnly to config**

In `server/config.js`, after line 61 (`openBetaDailyLimit`), add:

```js
inviteOnly: env('INVITE_ONLY', 'true') === 'true',
```

- [ ] **Step 2: Commit**

```bash
git add server/config.js
git commit -m "feat: add INVITE_ONLY config flag"
```

---

### Task 3: Invite Service

**Files:**
- Create: `server/services/invites.js`

This service encapsulates all invite logic: code generation, claiming, activation, reload, and bonus. All other files call into this service — it's the single source of truth for invite operations.

- [ ] **Step 1: Create the service**

```js
// server/services/invites.js
import crypto from 'node:crypto';

const BATCH_1_SIZE = 3;
const BATCH_2_SIZE = 3;
const WELCOME_CREDITS = 2;
const ACTIVATION_REWARD = 1;
const COMPLETION_BONUS = 2;

/**
 * Generate a unique 8-char uppercase hex code.
 */
function generateCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

/**
 * Generate N invite codes for a user (idempotent — checks invite_batch).
 * @param {object} db - database pool
 * @param {string} userId
 * @param {number} batch - 1 or 2
 * @returns {string[]} generated codes
 */
export async function generateInviteCodes(db, userId, batch) {
  const size = batch === 1 ? BATCH_1_SIZE : BATCH_2_SIZE;
  const codes = [];

  for (let i = 0; i < size; i++) {
    let code = generateCode();
    let inserted = false;
    for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
      try {
        await db.query(
          'INSERT INTO invite_codes (owner_id, code, batch) VALUES ($1, $2, $3)',
          [userId, code, batch]
        );
        inserted = true;
        codes.push(code);
      } catch (err) {
        if (err.code === '23505') { // unique_violation
          code = generateCode();
        } else {
          throw err;
        }
      }
    }
    if (!inserted) throw new Error('Failed to generate unique invite code');
  }

  await db.query('UPDATE users SET invite_batch = $1 WHERE id = $2', [batch, userId]);
  return codes;
}

/**
 * Claim an invite code for a new user.
 * Sets user active, awards welcome credits, generates their invite codes.
 * @returns {{ ok: true, credits: number }} on success
 */
export async function claimInvite(db, userId, code) {
  // Find the code
  const { rows } = await db.query(
    'SELECT id, owner_id, claimed_by FROM invite_codes WHERE code = $1',
    [code]
  );

  if (!rows[0]) {
    const err = new Error('Codice invito non valido');
    err.statusCode = 404;
    throw err;
  }

  const invite = rows[0];

  if (invite.claimed_by) {
    const err = new Error('Codice invito già utilizzato');
    err.statusCode = 409;
    throw err;
  }

  if (invite.owner_id === userId) {
    const err = new Error('Non puoi usare il tuo codice');
    err.statusCode = 400;
    throw err;
  }

  // Claim: activate user, set invited_by, award credits
  await db.query(
    `UPDATE users SET status = 'active', invited_by = $1, credits = credits + $2 WHERE id = $3`,
    [invite.owner_id, WELCOME_CREDITS, userId]
  );

  await db.query(
    'UPDATE invite_codes SET claimed_by = $1, claimed_at = NOW() WHERE id = $2',
    [userId, invite.id]
  );

  // Generate invite codes for the new user
  const userBatch = await db.query('SELECT invite_batch FROM users WHERE id = $1', [userId]);
  if (userBatch.rows[0]?.invite_batch === 0) {
    await generateInviteCodes(db, userId, 1);
  }

  return { ok: true, credits: WELCOME_CREDITS };
}

/**
 * Called after a user's first CV generation.
 * Awards credit to inviter, checks for reload/bonus.
 * Failures are logged but don't throw — CV generation takes priority.
 */
export async function handleFirstGeneration(db, userId, logger) {
  try {
    const { rows } = await db.query('SELECT invited_by FROM users WHERE id = $1', [userId]);
    const invitedBy = rows[0]?.invited_by;
    if (!invitedBy) return;

    // Transaction: activate code + award credit + log
    const client = await db.pool ? db.pool.connect() : db.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        'UPDATE invite_codes SET activated = true, activated_at = NOW() WHERE claimed_by = $1 AND NOT activated',
        [userId]
      );

      await client.query(
        'UPDATE users SET credits = credits + $1 WHERE id = $2',
        [ACTIVATION_REWARD, invitedBy]
      );

      await client.query(
        `INSERT INTO credit_usage (user_id, action, credits_consumed) VALUES ($1, 'invite_reward', 0)`,
        [invitedBy]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Check for batch reload
    await checkBatchReload(db, invitedBy);

  } catch (err) {
    if (logger) logger.error({ err, userId }, 'Failed to process invite activation');
  }
}

/**
 * Check if all batch-1 codes are activated → generate batch 2.
 * Check if all 6 codes are activated → award completion bonus.
 */
async function checkBatchReload(db, ownerId) {
  const { rows: [user] } = await db.query(
    'SELECT invite_batch FROM users WHERE id = $1',
    [ownerId]
  );
  if (!user) return;

  if (user.invite_batch === 1) {
    // Check batch 1 completion
    const { rows: [stats] } = await db.query(
      `SELECT COUNT(*) FILTER (WHERE activated) as active, COUNT(*) as total
       FROM invite_codes WHERE owner_id = $1 AND batch = 1`,
      [ownerId]
    );

    if (+stats.total > 0 && +stats.active === +stats.total) {
      await generateInviteCodes(db, ownerId, 2);
      await db.query(
        `UPDATE users SET pending_gift = $1 WHERE id = $2`,
        [JSON.stringify({ type: 'invite_reload', codes: BATCH_2_SIZE }), ownerId]
      );
    }
  } else if (user.invite_batch === 2) {
    // Check full completion (all 6)
    const { rows: [stats] } = await db.query(
      `SELECT COUNT(*) FILTER (WHERE activated) as active, COUNT(*) as total
       FROM invite_codes WHERE owner_id = $1`,
      [ownerId]
    );

    if (+stats.total === (BATCH_1_SIZE + BATCH_2_SIZE) && +stats.active === +stats.total) {
      // Check if bonus already awarded (idempotent)
      const { rows: [existing] } = await db.query(
        `SELECT id FROM credit_usage WHERE user_id = $1 AND action = 'invite_bonus_complete' LIMIT 1`,
        [ownerId]
      );
      if (!existing) {
        await db.query('UPDATE users SET credits = credits + $1 WHERE id = $2', [COMPLETION_BONUS, ownerId]);
        await db.query(
          `INSERT INTO credit_usage (user_id, action, credits_consumed) VALUES ($1, 'invite_bonus_complete', 0)`,
          [ownerId]
        );
        await db.query(
          `UPDATE users SET pending_gift = $1 WHERE id = $2`,
          [JSON.stringify({ type: 'referral_complete', credits: COMPLETION_BONUS }), ownerId]
        );
      }
    }
  }
}

/**
 * Get invite stats for the account page.
 */
export async function getInviteStats(db, userId) {
  const { rows: codes } = await db.query(
    `SELECT ic.code, ic.batch, ic.claimed_by, ic.activated, ic.claimed_at, ic.activated_at,
            u.name as invitee_name, u.email as invitee_email
     FROM invite_codes ic
     LEFT JOIN users u ON ic.claimed_by = u.id
     WHERE ic.owner_id = $1
     ORDER BY ic.batch, ic.created_at`,
    [userId]
  );

  const { rows: [user] } = await db.query(
    'SELECT invite_batch FROM users WHERE id = $1',
    [userId]
  );

  const activated = codes.filter(c => c.activated).length;
  const total = codes.length;

  return {
    codes: codes.map(c => ({
      code: c.code,
      batch: c.batch,
      status: c.activated ? 'activated' : c.claimed_by ? 'claimed' : 'available',
      inviteeName: c.invitee_name || null,
      inviteeEmail: c.invitee_email || null,
      claimedAt: c.claimed_at,
      activatedAt: c.activated_at,
    })),
    activated,
    total,
    maxTotal: BATCH_1_SIZE + BATCH_2_SIZE,
    batch: user?.invite_batch || 0,
    creditsEarned: activated * ACTIVATION_REWARD,
  };
}

/**
 * Generate an admin invite code (no owner).
 */
export async function generateAdminInvite(db) {
  let code = generateCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await db.query(
        'INSERT INTO invite_codes (owner_id, code, batch) VALUES (NULL, $1, 0)',
        [code]
      );
      return code;
    } catch (err) {
      if (err.code === '23505') {
        code = generateCode();
      } else {
        throw err;
      }
    }
  }
  throw new Error('Failed to generate unique admin invite code');
}
```

- [ ] **Step 2: Verify the service loads**

Run: `node -e "import('./server/services/invites.js').then(() => console.log('OK')).catch(e => console.error(e.message))"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add server/services/invites.js
git commit -m "feat: add invite service (generation, claiming, activation, stats)"
```

---

## Chunk 2: Auth Flow Changes

### Task 4: Auth Guard — Waitlist Check

**Files:**
- Modify: `server/middleware/auth-guard.js`

Add a new `activeGuard` that rejects waitlisted users. The existing `authGuard` stays unchanged — `claim-invite` needs auth but NOT active status.

- [ ] **Step 1: Add activeGuard**

In `server/middleware/auth-guard.js`, add after the existing `authGuard` function:

```js
export function activeGuard(request, reply, done) {
  if (!request.user?.id) {
    reply.code(401).send({ error: 'Not authenticated' });
    return;
  }
  if (request.user.status === 'waitlist') {
    reply.code(403).send({ error: 'waitlist' });
    return;
  }
  done();
}
```

- [ ] **Step 2: Commit**

```bash
git add server/middleware/auth-guard.js
git commit -m "feat: add activeGuard middleware for waitlist check"
```

---

### Task 5: Auth Routes — Invite & Waitlist Endpoints

**Files:**
- Modify: `server/routes/auth.js`

Changes:
1. Add `status` to JWT payload in `setAuthCookie()`.
2. Set new user status based on `config.inviteOnly`.
3. Add `POST /claim-invite` endpoint.
4. Add `POST /waitlist` endpoint.
5. Add `GET /invite-stats` endpoint.
6. Disable guest login when `config.inviteOnly`.
7. Replace old referral endpoints.

- [ ] **Step 1: Update setAuthCookie to include status**

In `server/routes/auth.js`, modify `setAuthCookie` (line 10-18):

```js
function setAuthCookie(reply, user, guest = false) {
  const token = sign(
    { id: user.id, guest, role: user.role || 'user', status: user.status || 'active' },
    config.jwtSecret,
    MAX_AGE_S
  );
  reply.setCookie(COOKIE_NAME, token, {
    path: '/',
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    maxAge: MAX_AGE_MS / 1000,
  });
}
```

- [ ] **Step 2: Update findOrCreateUser to set status and generate invite codes**

Add import at the top of the file:

```js
import { generateInviteCodes } from '../services/invites.js';
```

Modify `findOrCreateUser` — change the INSERT query to include status, and generate invite codes after creation:

```js
async function findOrCreateUser({ email, name, googleId, linkedinId }) {
  if (googleId) {
    const found = await app.db.query('SELECT * FROM users WHERE google_id = $1', [googleId]);
    if (found.rows[0]) return { user: found.rows[0], isNew: false };
  }
  if (linkedinId) {
    const found = await app.db.query('SELECT * FROM users WHERE linkedin_id = $1', [linkedinId]);
    if (found.rows[0]) return { user: found.rows[0], isNew: false };
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
    return { user, isNew: false };
  }

  // New user: status depends on invite-only mode
  const status = config.inviteOnly ? 'waitlist' : 'active';
  const referralCode = crypto.randomBytes(3).toString('hex').toUpperCase();
  const result = await app.db.query(
    'INSERT INTO users (email, name, google_id, linkedin_id, referral_code, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    [email, name, googleId || null, linkedinId || null, referralCode, status]
  );
  const user = result.rows[0];

  // If not invite-only (open registration), generate invite codes immediately
  if (!config.inviteOnly && user.invite_batch === 0) {
    await generateInviteCodes(app.db, user.id, 1).catch(() => {});
  }

  return { user, isNew: true };
}
```

- [ ] **Step 3: Add claim-invite endpoint**

After the referral endpoints section (line ~257), add:

```js
// ── Invite system ──

app.post('/claim-invite', async (req, reply) => {
  // Note: this endpoint requires auth but NOT active status (waitlisted users can call it)
  const userId = req.user?.id;
  if (!userId) return reply.code(401).send({ error: 'Not authenticated' });

  const { code } = req.body;
  if (!code) return reply.code(400).send({ error: 'code required' });

  const { claimInvite } = await import('../services/invites.js');
  const result = await claimInvite(app.db, userId, code);

  // Re-issue JWT with updated status
  const userRes = await app.db.query('SELECT * FROM users WHERE id = $1', [userId]);
  if (userRes.rows[0]) {
    setAuthCookie(reply, userRes.rows[0], false);
  }

  reply.send(result);
});

app.get('/invite-stats', async (req, reply) => {
  const userId = req.user?.id;
  if (!userId) return reply.code(401).send({ error: 'Not authenticated' });

  const { getInviteStats } = await import('../services/invites.js');
  const stats = await getInviteStats(app.db, userId);
  reply.send(stats);
});
```

- [ ] **Step 4: Add waitlist endpoint**

```js
app.post('/waitlist', {
  config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  schema: {
    body: {
      type: 'object',
      required: ['email'],
      properties: {
        email: { type: 'string', format: 'email', maxLength: 255 },
      },
    },
  },
}, async (req, reply) => {
  const { email } = req.body;
  try {
    await app.db.query(
      'INSERT INTO waitlist (email) VALUES ($1) ON CONFLICT (email) DO NOTHING',
      [email.toLowerCase().trim()]
    );
  } catch { /* ignore */ }
  reply.send({ ok: true });
});
```

- [ ] **Step 5: Disable guest login when invite-only**

Modify the guest endpoint (currently around line 147). Wrap the existing handler:

```js
app.post('/guest', {
  config: { rateLimit: { max: 3, timeWindow: '1 minute' } },
}, async (req, reply) => {
  if (config.inviteOnly) {
    return reply.code(403).send({ error: 'invite_required' });
  }
  const guestId = crypto.randomUUID();
  const guestEmail = `guest-${guestId.slice(0, 8)}@anonymous`;
  const result = await app.db.query(
    'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING *',
    [guestEmail, 'Ospite']
  );
  const user = result.rows[0];
  auditLog(req, user.id, 'login_guest');
  setAuthCookie(reply, user, true);
  return reply.send({ user: { id: user.id, name: user.name, email: null, guest: true } });
});
```

- [ ] **Step 6: Verify server starts**

Run: `cd /Users/paolodiana/Documents/Job\ Hacker && node --check server/routes/auth.js`

Expected: No syntax errors.

- [ ] **Step 7: Commit**

```bash
git add server/routes/auth.js
git commit -m "feat: add invite claim, waitlist, and invite-stats endpoints"
```

---

### Task 6: Update Route Guards

**Files:**
- Modify: `server/routes/cv.js:5` — switch from `authGuard` to `activeGuard`
- Modify: `server/routes/ai.js:23` — switch from `authGuard` to `activeGuard`

The CV and AI routes should reject waitlisted users. The auth routes keep `authGuard` (claim-invite needs to work for waitlisted users).

- [ ] **Step 1: Update cv.js**

In `server/routes/cv.js`, change the import (line 1):

```js
import { activeGuard, registeredGuard } from '../middleware/auth-guard.js';
```

And change line 5:

```js
app.addHook('preHandler', activeGuard);
```

- [ ] **Step 2: Update ai.js**

In `server/routes/ai.js`, change line 1:

```js
import { activeGuard } from '../middleware/auth-guard.js';
```

And change line 23:

```js
app.addHook('preHandler', activeGuard);
```

- [ ] **Step 3: Commit**

```bash
git add server/routes/cv.js server/routes/ai.js
git commit -m "feat: use activeGuard to block waitlisted users from CV/AI routes"
```

---

## Chunk 3: Activation Trigger & Admin

### Task 7: AI Route — First Generation Activation

**Files:**
- Modify: `server/routes/ai.js` — add activation trigger in `/generate` handler

- [ ] **Step 1: Add activation trigger**

In `server/routes/ai.js`, add import at the top:

```js
import { handleFirstGeneration } from '../services/invites.js';
```

In the `/generate` handler (around line 130-149), the current code does:
1. Build prompt
2. Call openrouter.generate
3. Parse JSON
4. consumeCredits
5. reply.send

Modify to check first-generation status **before** consuming credits, then trigger activation **after** success:

```js
}, async (req, reply) => {
  const { profile, jobDescription, language, targetKeywords } = req.body;
  if (!profile || !jobDescription) return reply.code(400).send({ error: 'profile and jobDescription required' });

  // Check if this is the user's first generation (before the new one is saved)
  let isFirstGeneration = false;
  try {
    const { rows: [{ count }] } = await app.db.query(
      `SELECT COUNT(*)::int as count FROM generated_cvs
       WHERE profile_id IN (SELECT id FROM cv_profiles WHERE user_id = $1)`,
      [req.user.id]
    );
    isFirstGeneration = count === 0;
  } catch { /* non-critical */ }

  const prompt = buildGenerationPrompt(profile, jobDescription, language || 'it', targetKeywords || null);
  const result = await openrouter.generate([{ role: 'user', content: prompt }]);
  try {
    const parsed = parseJSON(result);
    await consumeCredits(req.server.db, req.user.id, 'cv_generation');

    // Trigger invite activation if first generation
    if (isFirstGeneration) {
      handleFirstGeneration(app.db, req.user.id, req.log).catch(() => {});
    }

    reply.send(parsed);
  } catch {
    app.db.query(
      `INSERT INTO error_logs (level, endpoint, message, user_id, status_code)
       VALUES ('warn', $1, $2, $3, 422)`,
      [`POST /api/ai/generate`, 'JSON parse failure: ' + (result || '').substring(0, 500), req.user?.id]
    ).catch(() => {});
    reply.code(422).send({ error: 'Failed to parse generated CV' });
  }
});
```

**Important**: `handleFirstGeneration` runs fire-and-forget (`.catch(() => {})`) — it must never block or fail the CV generation response.

- [ ] **Step 2: Commit**

```bash
git add server/routes/ai.js
git commit -m "feat: trigger invite activation reward on first CV generation"
```

---

### Task 8: Admin Routes — Waitlist Management

**Files:**
- Modify: `server/routes/admin.js` — add waitlist endpoints

- [ ] **Step 1: Add waitlist endpoints**

In `server/routes/admin.js`, add at the end (before the closing `}`):

```js
// ── Waitlist management ──
app.get('/waitlist', async (req, reply) => {
  const { search, limit, offset } = req.query;
  const lim = Math.min(parseInt(limit) || 50, 200);
  const off = parseInt(offset) || 0;

  let where = 'WHERE 1=1';
  const params = [];
  if (search) {
    params.push(`%${search}%`);
    where += ` AND w.email ILIKE $${params.length}`;
  }

  params.push(lim, off);

  const { rows } = await app.db.query(`
    SELECT w.*, (w.invited_at IS NOT NULL) as invited
    FROM waitlist w ${where}
    ORDER BY w.created_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `, params);

  const countRes = await app.db.query(
    `SELECT COUNT(*) as n FROM waitlist w ${where}`,
    search ? [`%${search}%`] : []
  );

  reply.send({ waitlist: rows, total: +countRes.rows[0].n });
});

app.post('/waitlist/:id/invite', async (req, reply) => {
  const { id } = req.params;

  const wl = await app.db.query('SELECT id, email, invited_at FROM waitlist WHERE id = $1', [id]);
  if (!wl.rows[0]) return reply.code(404).send({ error: 'Waitlist entry not found' });
  if (wl.rows[0].invited_at) return reply.code(409).send({ error: 'Already invited' });

  const { generateAdminInvite } = await import('../services/invites.js');
  const code = await generateAdminInvite(app.db);

  await app.db.query('UPDATE waitlist SET invited_at = NOW() WHERE id = $1', [id]);

  // Audit log
  await app.db.query(
    `INSERT INTO audit_logs (user_id, action, ip, user_agent, metadata)
     VALUES ($1, 'admin_waitlist_invite', $2, $3, $4)`,
    [req.user.id, req.ip, req.headers['user-agent']?.substring(0, 500) || null,
     JSON.stringify({ waitlistId: id, email: wl.rows[0].email, code })]
  );

  reply.send({ ok: true, code, email: wl.rows[0].email });
});
```

- [ ] **Step 2: Commit**

```bash
git add server/routes/admin.js
git commit -m "feat: add admin waitlist management endpoints"
```

---

## Chunk 4: Frontend

### Task 9: API Methods

**Files:**
- Modify: `public/js/api.js`

- [ ] **Step 1: Add new API methods**

In `public/js/api.js`, replace the old referral methods and add new ones. Replace lines 71-72:

```js
// Old referral (deprecated)
// claimReferral: (code) => request('/auth/referral-claim', { method: 'POST', body: { code } }),
// getReferralStats: () => request('/auth/referral-stats'),

// Invite system
claimInvite: (code) => request('/auth/claim-invite', { method: 'POST', body: { code } }),
getInviteStats: () => request('/auth/invite-stats'),
joinWaitlist: (email) => request('/auth/waitlist', { method: 'POST', body: { email } }),

// Keep old methods for backward compat (no-op)
claimReferral: () => Promise.resolve({}),
getReferralStats: () => Promise.resolve({ code: null, referrals: 0, creditsEarned: 0, maxReferrals: 0 }),
```

Add admin waitlist methods after line 87:

```js
adminWaitlist: (params) => request(`/admin/waitlist?${new URLSearchParams(params)}`),
adminInviteWaitlist: (id) => request(`/admin/waitlist/${id}/invite`, { method: 'POST' }),
```

- [ ] **Step 2: Commit**

```bash
git add public/js/api.js
git commit -m "feat: add invite system API methods"
```

---

### Task 10: Strings

**Files:**
- Modify: `public/js/strings.js`

- [ ] **Step 1: Update strings**

In `public/js/strings.js`, replace the `referral` section and update `beta` section:

Replace the referral block (lines 287-294):

```js
// ── Invite System ──
invite: {
  title: 'I tuoi inviti',
  subtitle: 'Ogni invitato che genera un CV ti regala 1 credito.',
  available: 'Disponibile',
  claimed: 'In attesa del primo CV',
  activated: 'Attivo — +1 credito',
  whatsapp: 'Invia su WhatsApp',
  copyLink: 'Copia link',
  copied: 'Copiato!',
  progress: (active, total) => `${active}/${total} inviti attivi`,
  reloadUnlocked: 'Nuovi inviti sbloccati!',
  bonusComplete: '+2 crediti bonus!',
  noInvites: 'I tuoi inviti verranno generati a breve.',
},
```

Update beta strings (lines 262-272) — change `5` to `2`:

```js
beta: {
  badge: 'OPEN BETA',
  dailyLimit: (used, limit) => `${limit - used}/${limit} CV rimasti oggi`,
  dailyExhausted: 'Hai raggiunto il limite giornaliero. Torna domani!',
  modalTitle: 'Open Beta — Gratis',
  modalText: 'Durante la beta puoi generare fino a 2 CV al giorno, gratis. Nessuna carta di credito richiesta.',
  modalHint: 'Invita amici per ottenere crediti extra.',
  landingTitle: 'Accesso su invito',
  landingText: '2 CV / giorno + invita amici per di più.',
},
```

Add waitlist strings in the landing section after `loginLink` (line 18):

```js
waitlistTitle: 'Richiedi accesso',
waitlistPlaceholder: 'La tua email',
waitlistBtn: 'Entra in lista',
waitlistDone: 'Sei in lista. Ti avviseremo.',
inviteCTA: 'Entra con il tuo invito',
inviteBadge: 'Hai un invito da un utente JobHacker',
```

Add waitlist screen strings in the `auth` section:

```js
waitlistTitle: 'Sei in lista d\'attesa',
waitlistText: 'Ti avviseremo quando sara\' il tuo turno. Hai un codice invito? Inseriscilo qui sotto.',
waitlistInput: 'Codice invito',
waitlistClaim: 'Usa invito',
waitlistError: 'Codice non valido o gia\' usato.',
```

- [ ] **Step 2: Commit**

```bash
git add public/js/strings.js
git commit -m "feat: add invite system and waitlist strings"
```

---

### Task 11: App.js — Invite Code Capture & Waitlist Screen

**Files:**
- Modify: `public/js/app.js`

Changes:
1. Capture `?invite=CODE` from URL (in addition to existing `#ref=` capture).
2. After login, auto-claim invite code from localStorage.
3. Handle 403 waitlist response by showing waitlist UI.

- [ ] **Step 1: Add invite code capture**

In `public/js/app.js`, inside the `navigate` function, after the existing referral capture block (lines 26-30), add:

```js
// Capture invite code from URL (?invite=CODE)
const urlParams = new URLSearchParams(window.location.search);
const inviteCode = urlParams.get('invite');
if (inviteCode) {
  localStorage.setItem('jh_invite_code', inviteCode.toUpperCase());
  // Clean URL without reload
  const cleanUrl = window.location.pathname + window.location.hash;
  window.history.replaceState(null, '', cleanUrl);
}
```

- [ ] **Step 2: Add auto-claim after login**

After the `getMe()` call succeeds and `currentUser` is set (around line 52-58), replace the existing referral claim block with:

```js
// Claim invite code if pending
const pendingInvite = localStorage.getItem('jh_invite_code');
if (pendingInvite && currentUser && !currentUser.guest) {
  try {
    await api.claimInvite(pendingInvite);
    localStorage.removeItem('jh_invite_code');
    // Re-fetch user (status may have changed)
    const { user: refreshed } = await api.getMe();
    currentUser = refreshed;
  } catch {
    localStorage.removeItem('jh_invite_code');
  }
}

// Legacy referral claim
const pendingRef = localStorage.getItem('jh-referral');
if (pendingRef && currentUser && !currentUser.guest) {
  api.claimReferral(pendingRef).catch(() => {});
  localStorage.removeItem('jh-referral');
}
```

- [ ] **Step 3: Add waitlist screen**

After the `if (!currentUser)` block that renders the landing (around line 64-67), add a waitlist check. The `getMe` endpoint returns the user even if waitlisted (they're authenticated), but the user object should include status. First, we need to check — look at the `/me` endpoint. It doesn't return `status` currently, but we can check if the API returns a 403 on other calls.

Actually, simpler approach: check `currentUser.status`:

Add after `if (!currentUser)` block:

```js
// Waitlist gate
if (currentUser.status === 'waitlist') {
  renderWaitlistScreen(root);
  return;
}
```

Add the `renderWaitlistScreen` function at the bottom of the file:

```js
function renderWaitlistScreen(container) {
  container.textContent = '';

  const page = document.createElement('div');
  page.className = 'waitlist-page';

  const card = document.createElement('div');
  card.className = 'login-card';

  const img = document.createElement('img');
  img.src = '/img/mascot/empty.webp';
  img.alt = 'JH in attesa';
  img.className = 'waitlist-img';
  card.appendChild(img);

  const h2 = document.createElement('h2');
  h2.textContent = t('auth.waitlistTitle');
  card.appendChild(h2);

  const text = document.createElement('p');
  text.className = 'login-subtitle';
  text.textContent = t('auth.waitlistText');
  card.appendChild(text);

  // Invite code input
  const form = document.createElement('div');
  form.className = 'waitlist-form';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = t('auth.waitlistInput');
  input.maxLength = 8;
  input.className = 'waitlist-input';
  input.style.textTransform = 'uppercase';
  form.appendChild(input);

  const claimBtn = document.createElement('button');
  claimBtn.className = 'btn-primary';
  claimBtn.textContent = t('auth.waitlistClaim');
  claimBtn.addEventListener('click', async () => {
    const code = input.value.trim().toUpperCase();
    if (!code) return;
    claimBtn.disabled = true;
    claimBtn.textContent = '...';
    try {
      await api.claimInvite(code);
      navigate(); // Re-navigate — user is now active
    } catch {
      const err = document.createElement('p');
      err.className = 'waitlist-error';
      err.textContent = t('auth.waitlistError');
      form.appendChild(err);
      setTimeout(() => err.remove(), 3000);
    }
    claimBtn.disabled = false;
    claimBtn.textContent = t('auth.waitlistClaim');
  });
  form.appendChild(claimBtn);

  card.appendChild(form);

  // Logout option
  const logoutBtn = document.createElement('button');
  logoutBtn.className = 'btn-secondary';
  logoutBtn.textContent = 'Esci';
  logoutBtn.style.marginTop = '16px';
  logoutBtn.addEventListener('click', async () => {
    await api.logout();
    navigate();
  });
  card.appendChild(logoutBtn);

  page.appendChild(card);
  container.appendChild(page);
}
```

Add import for `t` at the top of `app.js`:

```js
import { t } from './strings.js';
```

- [ ] **Step 4: Update /me endpoint to return status**

In `server/routes/auth.js`, in the `GET /me` handler, add `status` to the returned user object. In the query (line ~165), add `u.status` to the SELECT. In the response object (line ~174-185), add:

```js
status: user.status || 'active',
```

- [ ] **Step 5: Commit**

```bash
git add public/js/app.js server/routes/auth.js
git commit -m "feat: add invite code capture, auto-claim, and waitlist screen"
```

---

### Task 12: Landing Page — Invite Mode

**Files:**
- Modify: `public/js/landing.js`

Changes:
1. Detect invite code from localStorage.
2. Change hero CTA when invite code present.
3. Add waitlist form when no invite code and invite-only mode.

- [ ] **Step 1: Update hero CTA**

In `public/js/landing.js`, inside `renderLanding`, after the hero content is built (around line 91), modify the `tryBtn` creation to check for invite code:

Replace the tryBtn block (lines 95-108) with:

```js
const hasInvite = !!localStorage.getItem('jh_invite_code');

const tryBtn = document.createElement('button');
tryBtn.className = 'btn-primary btn-lg';
tryBtn.textContent = hasInvite ? t('landing.inviteCTA') : t('landing.tryFree');
tryBtn.addEventListener('click', async () => {
  track('landing_cta_click', { position: 'hero', hasInvite });
  if (hasInvite) {
    // Go to login — after OAuth, app.js will auto-claim the invite
    showLoginSection(page);
  } else {
    tryBtn.disabled = true;
    tryBtn.textContent = t('landing.wait');
    try {
      await api.guestLogin();
      track('signup', { method: 'guest' });
      navigate();
    } catch {
      tryBtn.disabled = false;
      tryBtn.textContent = t('landing.tryFree');
    }
  }
});
heroCTA.appendChild(tryBtn);

if (hasInvite) {
  const inviteBadge = document.createElement('span');
  inviteBadge.className = 'landing-invite-badge';
  inviteBadge.textContent = t('landing.inviteBadge');
  heroCTA.appendChild(inviteBadge);
} else {
  const tryHint = document.createElement('span');
  tryHint.className = 'landing-try-hint';
  tryHint.textContent = t('landing.tryHint');
  heroCTA.appendChild(tryHint);
}
```

- [ ] **Step 2: Update final CTA similarly**

Replace the final CTA button block (lines 408-420) with the same pattern — check `hasInvite` and adjust text/behavior.

```js
const ctaBtn = document.createElement('button');
ctaBtn.className = 'btn-primary btn-lg';
ctaBtn.textContent = hasInvite ? t('landing.inviteCTA') : t('landing.ctaBtn');
ctaBtn.addEventListener('click', async () => {
  track('landing_cta_click', { position: 'final', hasInvite });
  if (hasInvite) {
    showLoginSection(page);
  } else {
    ctaBtn.disabled = true;
    ctaBtn.textContent = t('landing.wait');
    try {
      await api.guestLogin();
      track('signup', { method: 'guest' });
      navigate();
    } catch {
      ctaBtn.disabled = false;
      ctaBtn.textContent = hasInvite ? t('landing.inviteCTA') : t('landing.ctaBtn');
    }
  }
});
finalCta.appendChild(ctaBtn);
```

- [ ] **Step 3: Update pricing teaser section**

Replace the beta card text (lines 377-384) with invite-aware copy:

```js
const betaDetail = document.createElement('div');
betaDetail.className = 'price-detail';
betaDetail.textContent = t('beta.landingText');
betaCard.appendChild(betaDetail);
```

- [ ] **Step 4: Add waitlist form to login section**

In the `showLoginSection` function (line 485+), add a waitlist email form after the guest button. Add between the guest button and closing the card:

```js
// Waitlist form (for users without invite)
if (!localStorage.getItem('jh_invite_code')) {
  const waitlistDiv = document.createElement('div');
  waitlistDiv.className = 'landing-waitlist';

  const waitlistLabel = document.createElement('p');
  waitlistLabel.className = 'login-subtitle';
  waitlistLabel.textContent = t('landing.waitlistTitle');
  waitlistLabel.style.marginTop = '24px';
  waitlistDiv.appendChild(waitlistLabel);

  const waitlistForm = document.createElement('div');
  waitlistForm.className = 'waitlist-inline-form';

  const emailInput = document.createElement('input');
  emailInput.type = 'email';
  emailInput.placeholder = t('landing.waitlistPlaceholder');
  emailInput.className = 'waitlist-input';
  waitlistForm.appendChild(emailInput);

  const waitlistBtn = document.createElement('button');
  waitlistBtn.className = 'btn-secondary';
  waitlistBtn.textContent = t('landing.waitlistBtn');
  waitlistBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    if (!email) return;
    waitlistBtn.disabled = true;
    try {
      await api.joinWaitlist(email);
      waitlistForm.textContent = '';
      const done = document.createElement('p');
      done.className = 'waitlist-done';
      done.textContent = t('landing.waitlistDone');
      waitlistForm.appendChild(done);
    } catch {
      waitlistBtn.disabled = false;
    }
  });
  waitlistForm.appendChild(waitlistBtn);

  waitlistDiv.appendChild(waitlistForm);
  card.appendChild(waitlistDiv);
}
```

- [ ] **Step 5: Commit**

```bash
git add public/js/landing.js
git commit -m "feat: landing page invite mode with CTA changes and waitlist form"
```

---

### Task 13: Account Page — Invite Section

**Files:**
- Modify: `public/js/account.js`

Replace `renderReferralSection()` with new `renderInviteSection()`.

- [ ] **Step 1: Replace the referral section**

Replace the entire `renderReferralSection` function (lines 278-351) with:

```js
function renderInviteSection() {
  const section = document.createElement('div');
  section.className = 'account-section card invite-section';

  const h2 = document.createElement('h2');
  h2.textContent = t('invite.title');
  section.appendChild(h2);

  const hint = document.createElement('small');
  hint.className = 'account-hint';
  hint.textContent = t('invite.subtitle');
  section.appendChild(hint);

  const loading = document.createElement('p');
  loading.className = 'account-empty';
  loading.textContent = 'Caricamento...';
  section.appendChild(loading);

  api.getInviteStats().then(data => {
    loading.remove();

    if (!data.codes || data.codes.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'account-empty';
      empty.textContent = t('invite.noInvites');
      section.appendChild(empty);
      return;
    }

    // Progress bar
    const progressWrap = document.createElement('div');
    progressWrap.className = 'invite-progress-wrap';

    const progressBar = document.createElement('div');
    progressBar.className = 'invite-progress-bar';
    const progressFill = document.createElement('div');
    progressFill.className = 'invite-progress-fill';
    progressFill.style.width = `${(data.activated / data.maxTotal) * 100}%`;
    progressBar.appendChild(progressFill);
    progressWrap.appendChild(progressBar);

    const progressText = document.createElement('span');
    progressText.className = 'invite-progress-text';
    progressText.textContent = t('invite.progress')(data.activated, data.maxTotal);
    progressWrap.appendChild(progressText);

    section.appendChild(progressWrap);

    // Invite code cards
    const list = document.createElement('div');
    list.className = 'invite-list';

    for (const code of data.codes) {
      const card = document.createElement('div');
      card.className = `invite-card invite-${code.status}`;

      const codeEl = document.createElement('span');
      codeEl.className = 'invite-code';
      codeEl.textContent = code.code;
      card.appendChild(codeEl);

      if (code.status === 'available') {
        const statusEl = document.createElement('span');
        statusEl.className = 'invite-status';
        statusEl.textContent = t('invite.available');
        card.appendChild(statusEl);

        const actions = document.createElement('div');
        actions.className = 'invite-actions';

        const shareLink = `https://jobhacker.it/?invite=${code.code}`;
        const whatsappText = `${shareLink}\nmetti l'annuncio, esce il CV. passa i filtri.\n— JH 🦝`;
        const waBtn = document.createElement('a');
        waBtn.href = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;
        waBtn.target = '_blank';
        waBtn.rel = 'noopener';
        waBtn.className = 'btn-primary btn-sm';
        waBtn.textContent = t('invite.whatsapp');
        actions.appendChild(waBtn);

        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn-secondary btn-sm';
        copyBtn.textContent = t('invite.copyLink');
        copyBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(shareLink).then(() => {
            copyBtn.textContent = t('invite.copied');
            setTimeout(() => { copyBtn.textContent = t('invite.copyLink'); }, 2000);
          });
        });
        actions.appendChild(copyBtn);

        card.appendChild(actions);
      } else if (code.status === 'claimed') {
        const info = document.createElement('span');
        info.className = 'invite-invitee';
        info.textContent = code.inviteeName || code.inviteeEmail || '...';
        card.appendChild(info);

        const statusEl = document.createElement('span');
        statusEl.className = 'invite-status pending';
        statusEl.textContent = t('invite.claimed');
        card.appendChild(statusEl);
      } else if (code.status === 'activated') {
        const info = document.createElement('span');
        info.className = 'invite-invitee';
        info.textContent = code.inviteeName || code.inviteeEmail || '...';
        card.appendChild(info);

        const statusEl = document.createElement('span');
        statusEl.className = 'invite-status active';
        statusEl.textContent = t('invite.activated');
        card.appendChild(statusEl);
      }

      list.appendChild(card);
    }

    section.appendChild(list);

    // Credits earned
    if (data.creditsEarned > 0) {
      const earned = document.createElement('div');
      earned.className = 'invite-earned';
      earned.textContent = `${data.creditsEarned} crediti guadagnati dagli inviti`;
      section.appendChild(earned);
    }
  }).catch(() => {
    loading.textContent = 'Errore nel caricamento.';
  });

  return section;
}
```

- [ ] **Step 2: Update the renderAccount function call**

In `renderAccount` (line 22), change:

```js
// 4. Referral
wrapper.appendChild(renderReferralSection());
```

to:

```js
// 4. Invites
wrapper.appendChild(renderInviteSection());
```

- [ ] **Step 3: Commit**

```bash
git add public/js/account.js
git commit -m "feat: replace referral section with invite cards and WhatsApp sharing"
```

---

### Task 14: CSS for Invite UI

**Files:**
- Modify: `public/css/app.css`

- [ ] **Step 1: Add invite-specific styles**

Append to the end of `public/css/app.css`:

```css
/* ── Invite System ── */
.invite-section { }

.invite-progress-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 16px 0;
}

.invite-progress-bar {
  flex: 1;
  height: 8px;
  background: var(--color-border);
  border-radius: 4px;
  overflow: hidden;
}

.invite-progress-fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.invite-progress-text {
  font-size: 0.85rem;
  color: var(--color-muted);
  white-space: nowrap;
}

.invite-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 12px 0;
}

.invite-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  flex-wrap: wrap;
}

.invite-card.invite-activated {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 5%, var(--color-surface));
}

.invite-code {
  font-family: monospace;
  font-weight: 600;
  font-size: 0.95rem;
  letter-spacing: 1px;
}

.invite-status {
  font-size: 0.8rem;
  color: var(--color-muted);
}

.invite-status.pending {
  color: var(--color-warning, #FFA000);
}

.invite-status.active {
  color: var(--color-primary);
  font-weight: 600;
}

.invite-invitee {
  font-size: 0.85rem;
  flex: 1;
}

.invite-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.invite-earned {
  margin-top: 12px;
  font-size: 0.85rem;
  color: var(--color-primary);
  font-weight: 600;
}

/* Waitlist page */
.waitlist-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 24px;
}

.waitlist-img {
  width: 120px;
  height: auto;
  margin: 0 auto 16px;
  display: block;
}

.waitlist-form {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  flex-wrap: wrap;
}

.waitlist-input {
  flex: 1;
  min-width: 160px;
  padding: 10px 14px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 1rem;
  background: var(--color-surface);
  color: var(--color-text);
}

.waitlist-error {
  color: var(--color-error);
  font-size: 0.85rem;
  width: 100%;
  margin-top: 8px;
}

.waitlist-done {
  color: var(--color-primary);
  font-weight: 600;
}

/* Landing waitlist inline */
.waitlist-inline-form {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.landing-invite-badge {
  display: inline-block;
  padding: 4px 12px;
  background: color-mix(in srgb, var(--color-primary) 15%, transparent);
  color: var(--color-primary);
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
}
```

- [ ] **Step 2: Commit**

```bash
git add public/css/app.css
git commit -m "feat: add invite system and waitlist CSS"
```

---

### Task 15: Update Auth.js — Hide Guest Button in Invite-Only

**Files:**
- Modify: `public/js/auth.js`

The standalone login page (rendered by `renderLogin`) should also hide the guest button when in invite-only mode. Since we don't have the config on the frontend, we detect it: if a guest login returns 403 `invite_required`, we know we're in invite-only mode.

Actually, simpler: the login page is rendered from `landing.js` (the `showLoginSection` function). The standalone `auth.js` `renderLogin` is only used as a fallback. Since the landing page already handles this in Task 12, and `auth.js` is only used in edge cases, we can leave `auth.js` as-is for now — the guest button will just fail gracefully with a 403 if clicked.

- [ ] **Step 1: No changes needed — skip this task**

The landing page (Task 12) already handles the invite-only flow. The standalone `renderLogin` in `auth.js` is a secondary path — if a guest click fails, it's a non-issue.

---

### Task 16: End-to-End Verification

- [ ] **Step 1: Restart the app**

```bash
cd /Users/paolodiana/Documents/Job\ Hacker && docker compose down && docker compose up -d --build
```

- [ ] **Step 2: Run migration**

```bash
docker exec -i $(docker ps -q -f name=postgres) psql -U cvmaker -d cvmaker < server/db/migrations/008-invite-system.sql
```

- [ ] **Step 3: Set INVITE_ONLY env var**

Ensure `INVITE_ONLY=true` and `OPEN_BETA_DAILY_LIMIT=2` in the environment.

- [ ] **Step 4: Test the flow manually**

1. Visit landing page — should show "Richiedi accesso" / waitlist form
2. Visit with `?invite=CODE` — should show "Entra con il tuo invito"
3. Log in with OAuth + invite code → should activate user with 2 credits
4. Check Account page → should show 3 invite codes
5. Generate a CV → should trigger (no reward since you invited yourself via admin code)
6. Share a code → have another user claim it → verify 1 credit reward after their first generation

- [ ] **Step 5: Final commit if any fixes needed**
