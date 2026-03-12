# Invite-Only Viral Loop — Design Spec

## Goal

Turn JobHacker into an invite-only app with a self-sustaining viral loop. Each user gets limited invite codes, earns credits when invitees activate, and is incentivized to keep sharing. Users without an invite join a waitlist. The system transitions to open registration when traction is sufficient.

## Architecture

Invite-only gate on top of existing OAuth flow. New `invite_codes` table tracks individual codes per user. Waitlist table for gated signups. Credits system unchanged — rewards are added via existing `UPDATE users SET credits = credits + N` pattern. WhatsApp-first sharing with pre-written message.

## Context

- **Phase**: Pre-launch, few beta testers
- **Target**: Italian job seekers, WhatsApp/Telegram as primary sharing channel
- **Existing system**: Basic referral (6-char code, 2 credits to referrer, nothing to referred, cap 20) — effectively dead, no incentive for the referred user
- **Open beta**: Currently 5 CV/day free — reduces incentive to share. Will be reduced to 2/day.

---

## 1. Data Model

### New table: `invite_codes`

```sql
CREATE TABLE invite_codes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID REFERENCES users(id) ON DELETE CASCADE,  -- NULL for admin-generated codes
  code          VARCHAR(8) NOT NULL UNIQUE,
  batch         INTEGER NOT NULL DEFAULT 1,  -- 1 = initial 3, 2 = reload 3
  claimed_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  activated     BOOLEAN NOT NULL DEFAULT false,  -- true when invitee generates first CV
  created_at    TIMESTAMP DEFAULT NOW(),
  claimed_at    TIMESTAMP,
  activated_at  TIMESTAMP  -- for time-to-activation metrics
);

CREATE INDEX idx_invite_codes_owner ON invite_codes (owner_id);
-- Note: UNIQUE on `code` already creates an implicit index in PostgreSQL
```

### New table: `waitlist`

```sql
CREATE TABLE waitlist (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       VARCHAR(255) NOT NULL UNIQUE,
  created_at  TIMESTAMP DEFAULT NOW(),
  invited_at  TIMESTAMP  -- set when manually invited from admin
);
```

### Users table changes

```sql
ALTER TABLE users ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN invited_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN invite_batch INTEGER NOT NULL DEFAULT 0;  -- 0 = no codes yet, 1 = batch 1 generated, 2 = batch 2 generated
```

- `status`: `'active'` or `'waitlist'`. Default depends on `INVITE_ONLY` config flag.
- `invited_by`: who invited this user (direct parent only, no chain tracking).
- `invite_batch`: 0 = no codes generated yet, 1 = has initial 3 codes, 2 = reload granted. Max 2.

**Bootstrap for existing users**: The migration generates 3 batch-1 codes for all existing active users and sets their `invite_batch = 1`. This prevents the 0=0 false-positive on the reload check.

### What happens to existing referral system

The old `referrals` table and `referral_code` column stay for backward compatibility but are no longer used in the UI. The new `invite_codes` system replaces them entirely. No migration of old referral data needed (pre-launch, negligible data).

---

## 2. Invite Flow

### Code generation

- On user creation (if status = `active`): generate 3 invite codes (batch 1).
- Codes: 8 chars, uppercase alphanumeric, generated via `crypto.randomBytes(4).toString('hex').toUpperCase()`.
- Codes are rows in `invite_codes` with `claimed_by = NULL`.

### Claiming an invite

1. New user arrives at landing with `?invite=CODE` parameter.
2. Landing stores code in `localStorage`.
3. User authenticates via OAuth (Google/LinkedIn).
4. After OAuth callback, frontend sends `POST /api/auth/claim-invite` with the code.
   - **Important**: `claim-invite` is exempt from the waitlist check in `authGuard`. The user must be authenticated (have a valid JWT) but CAN be in `waitlist` status. This avoids a deadlock where a waitlisted user can't call the endpoint that would activate them.
5. Backend validates:
   - Code exists and `claimed_by IS NULL`.
   - Owner is not the same user.
6. If valid:
   - Set `users.status = 'active'`, `users.invited_by = owner_id`.
   - Set `invite_codes.claimed_by = user_id`, `invite_codes.claimed_at = NOW()`.
   - Add 2 welcome credits to new user: `UPDATE users SET credits = credits + 2`.
   - Generate 3 invite codes (batch 1) for the new user.
   - **Re-issue JWT**: set a new auth cookie with `status: 'active'` in the response. This prevents the stale JWT problem — the user gets a fresh token immediately.
7. If invalid or no code: set `users.status = 'waitlist'` (when `INVITE_ONLY=true`).

### Guest users and invite-only mode

When `INVITE_ONLY=true`, **guest login is disabled**. The `POST /api/auth/guest` endpoint returns `403` with `{ error: 'invite_required' }`. Rationale: guests bypass the invite gate entirely and cannot be tracked for referral purposes. The landing CTA changes from "Inizia gratis" / "Prova senza account" to "Entra con il tuo invito" when invite-only is active.

### Activation trigger

When a user generates their first CV (in `ai.js` `/generate` endpoint, after successful generation):

1. **Before** inserting the generated CV, check count: `SELECT COUNT(*) FROM generated_cvs WHERE profile_id IN (SELECT id FROM cv_profiles WHERE user_id = $1)`.
2. Insert the generated CV as normal.
3. If the pre-insert count was 0 (i.e., this was the first generation):
   - Find who invited them: `SELECT invited_by FROM users WHERE id = $1`.
   - If `invited_by` is not null, run the following in a **single transaction**:
     - Mark the invite code as activated: `UPDATE invite_codes SET activated = true, activated_at = NOW() WHERE claimed_by = $1`.
     - Award 1 credit to the inviter: `UPDATE users SET credits = credits + 1 WHERE id = invited_by`.
     - Log in `credit_usage`: action = `'invite_reward'`.
   - If the transaction fails, log the error but do NOT fail the CV generation — the user's CV is more important than the referral reward. A background job or admin can reconcile later.

### Code reload (batch 2)

After an invite code is activated, check if all batch 1 codes for the owner are activated:

```sql
SELECT COUNT(*) FILTER (WHERE activated) as active,
       COUNT(*) as total
FROM invite_codes
WHERE owner_id = $1 AND batch = 1
```

If `active = total = 3` AND `total > 0` AND `user.invite_batch = 1`:
- Generate 3 new codes with `batch = 2`.
- Set `users.invite_batch = 2`.
- Set `users.pending_gift = '{"type": "invite_reload", "codes": 3}'` (reuse existing gift notification system).

### Bonus premium (6/6 completion)

After batch 2 activation check, if ALL 6 codes (batch 1 + 2) are activated:
- Award **2 bonus credits**: `UPDATE users SET credits = credits + 2`.
- Log in `credit_usage`: action = `'invite_bonus_complete'`.
- Set `users.pending_gift = '{"type": "referral_complete", "credits": 2}'` (reuse existing gift notification).

No special flags or creditGuard changes needed — just credits.

---

## 3. Waitlist

### Endpoint

`POST /api/auth/waitlist` — public, no auth required.

```json
{ "email": "user@example.com" }
```

- Validates email format.
- Inserts into `waitlist` table (ignore duplicates).
- Returns `{ ok: true }`.
- Rate limited: 5 per minute per IP.

### Admin management

Add to existing admin panel (`/api/admin`):

- `GET /api/admin/waitlist` — list waitlisted emails with pagination.
- `POST /api/admin/waitlist/:id/invite` — generates an invite code with `owner_id = NULL` (admin-generated, no referrer), sets `invited_at` on the waitlist row. Does NOT auto-send email (manual for now). The admin copies the code and sends it manually. When the waitlisted user claims this code, they get 2 welcome credits but no one gets a referrer reward (since `owner_id` is NULL).

### Transition to open

When `INVITE_ONLY=false`:
- New users get `status = 'active'` by default.
- `findOrCreateUser()` skips the invite requirement.
- Invite codes still work as a referral mechanism (welcome credits + referrer reward).
- Waitlist endpoint returns `{ ok: true, message: 'Registration is open' }` or is disabled.

---

## 4. Sharing via WhatsApp

### UI: Invite section in Account page

Replaces current referral section. Shows:

1. **Header**: "I tuoi inviti" with count `X/6`.
2. **Invite code cards** (one per code):
   - **Available**: code visible + "Invia su WhatsApp" button + "Copia link" button.
   - **Claimed (pending)**: invitee name/email + "in attesa del primo CV" label.
   - **Activated**: invitee name + checkmark + "+1 credito" label.
3. **Progress bar**: visual `X/3` or `X/6` with milestone markers.
4. **Reload notification**: when batch 2 unlocks, highlight the new codes.
5. **Bonus notification**: when 6/6, show "+2 crediti bonus!".

### WhatsApp message

"Invia su WhatsApp" button opens:

```
https://wa.me/?text=jobhacker.it%2F%3Finvite%3DCODICE%0Ametti%20l'annuncio%2C%20esce%20il%20CV.%20passa%20i%20filtri.%0A%E2%80%94%20JH%20%F0%9F%A6%9D
```

Decoded:
```
jobhacker.it/?invite=CODICE
metti l'annuncio, esce il CV. passa i filtri.
— JH 🦝
```

Short, hacker tone, signed by the raccoon. No pitch. The link speaks for itself.

### Landing page changes

- Read `?invite=CODE` from URL.
- Store in `localStorage` as `jh_invite_code`.
- Change hero CTA from "Inizia gratis" to **"Entra con il tuo invito"**.
- Show small badge: "Invitato da un utente JobHacker".
- After OAuth, frontend calls `POST /api/auth/claim-invite` with stored code.

---

## 5. Beta Reduction & Config

### Config changes

```js
// config.js additions
inviteOnly: env('INVITE_ONLY', 'true') === 'true',
```

### Beta daily limit

- `OPEN_BETA_DAILY_LIMIT` changes from `5` to `2`.
- Strings updated: "2 CV al giorno" everywhere.
- Landing pricing teaser: "2 CV / giorno + invita amici per di più".

### Auth guard change

`authGuard` middleware gains an additional check:

```js
if (req.user && req.user.status === 'waitlist') {
  return reply.code(403).send({ error: 'waitlist' });
}
```

Frontend handles `403 + error: 'waitlist'` by showing waitlist screen.

Note: this requires adding `status` to the JWT payload in `setAuthCookie()`, or querying the DB. **Decision**: add `status` to JWT payload — avoids extra DB query on every request. The JWT is re-issued when status changes (in `claim-invite` response and in `findOrCreateUser`), so staleness is not an issue.

---

## 6. Files Affected

### New files
- `server/db/migrations/008-invite-system.sql` — new tables and columns
- `server/services/invites.js` — invite code generation, claiming, activation logic

### Modified files
- `server/config.js` — add `inviteOnly` flag
- `server/routes/auth.js` — claim-invite endpoint, waitlist endpoint, findOrCreateUser changes, JWT payload update
- `server/routes/ai.js` — activation trigger after first CV generation
- `server/routes/admin.js` — waitlist management endpoints
- `server/middleware/auth-guard.js` — waitlist status check
- `server/services/credits.js` — update `OPEN_BETA_DAILY_LIMIT` reference
- `public/js/account.js` — new invite section replacing referral section
- `public/js/landing.js` — invite code handling, CTA changes, waitlist form
- `public/js/strings.js` — new strings for invite UI, updated beta strings
- `public/js/app.js` — waitlist screen handling on 403
- `public/js/auth.js` — pass invite code after OAuth
- `public/js/api.js` — new API methods (claimInvite, joinWaitlist, getInviteStats)

### Deleted/deprecated
- Referral section in `account.js` — replaced by invite section
- `referral-claim` and `referral-stats` endpoints in `auth.js` — replaced by invite endpoints (can remove or leave as dead code)

---

## 7. What We Are NOT Building

- **No email automation** — invites from waitlist are manual (admin panel).
- **No leaderboard** — too few users in pre-launch, would look empty.
- **No streak system** — job seekers use the tool intensely for weeks, not daily for months.
- **No badges/achievements** — complexity without ROI at this stage.
- **No chain rewards** — credits only from direct invites, no multi-level tracking.
- **No Telegram/LinkedIn share buttons** — WhatsApp + copy link covers the target. Add others later with data.
- **No automated waitlist drip** — manual control over who gets in and when.

---

## 8. Success Metrics

- **Viral coefficient (k)**: invites sent per user × conversion rate. Target: k > 1 (each user brings >1 new active user).
- **Activation rate**: % of invited users who generate their first CV. Target: >60%.
- **Invite completion**: % of users who use all 6 invites. Target: >20%.
- **Time to activation**: hours between signup and first CV generation. Target: <24h.
- **Waitlist conversion**: % of waitlisted users who eventually get invited and activate.

Trackable via existing `audit_logs` and `credit_usage` tables + new `invite_codes` data. Admin panel stats endpoint to be added.
