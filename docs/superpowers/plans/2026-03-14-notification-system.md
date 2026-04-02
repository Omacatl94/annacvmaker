# Notification System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent in-app notifications with bell icon + dropdown, covering invite lifecycle, credit events, and admin actions.

**Architecture:** PostgreSQL table `notifications` + centralized `notify()` service + 3 API endpoints + bell icon in Header with dropdown. Polling-based (60s count check). Replaces `pending_gift` pattern.

**Tech Stack:** Node.js/Fastify (server), React (client), PostgreSQL (DB)

**Spec:** `docs/superpowers/specs/2026-03-14-notification-system-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `server/db/migrations/010-notifications.sql` | DB table + index |
| Create | `server/services/notifications.js` | `notify()` service |
| Create | `server/routes/notifications.js` | 3 API endpoints |
| Create | `client/src/components/NotificationBell.jsx` | Bell icon + badge + dropdown |
| Modify | `server/index.js:157-163` | Register notification routes |
| Modify | `server/services/invites.js:86-92,127-165` | 4 emit points |
| Modify | `server/routes/admin.js:216,236,354` | 3 emit points |
| Modify | `server/routes/feedback.js:76` | 1 emit point |
| Modify | `server/routes/payments.js:104` | 1 emit point (via credits.js) |
| Modify | `client/src/components/Header.jsx:89-91` | Add NotificationBell |
| Modify | `client/src/components/Icon.jsx` | Add missing icons |
| Modify | `client/src/strings.js` | Notification text generators |
| Modify | `client/src/api.js` | 3 new API methods |
| Modify | `client/css/app.css` | Bell + dropdown styles |

---

## Chunk 1: Backend Foundation

### Task 1: Database Migration

**Files:**
- Create: `server/db/migrations/010-notifications.sql`

- [ ] **Step 1: Create migration file**

```sql
-- 010-notifications.sql
-- In-app notification system

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(50) NOT NULL,
  data       JSONB NOT NULL DEFAULT '{}',
  read_at    TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_recent
  ON notifications (user_id, created_at DESC);
```

- [ ] **Step 2: Run migration**

Run: `psql $DATABASE_URL -f server/db/migrations/010-notifications.sql`
Expected: CREATE TABLE, CREATE INDEX ×2

- [ ] **Step 3: Commit**

```bash
git add server/db/migrations/010-notifications.sql
git commit -m "feat(db): add notifications table (migration 010)"
```

---

### Task 2: Notification Service

**Files:**
- Create: `server/services/notifications.js`

- [ ] **Step 1: Create notify service**

```js
// server/services/notifications.js

const VALID_TYPES = new Set([
  'invite_claimed',
  'invite_activated',
  'batch_reload',
  'referral_complete',
  'credits_received',
  'credits_purchased',
  'feedback_rewarded',
  'welcome_activated',
]);

/**
 * Insert a notification for a user. Fire-and-forget safe.
 * @param {object} db - database pool
 * @param {string} userId - recipient user ID
 * @param {string} type - one of VALID_TYPES
 * @param {object} data - type-specific payload
 */
export async function notify(db, userId, type, data = {}) {
  if (!userId || !VALID_TYPES.has(type)) return;
  await db.query(
    'INSERT INTO notifications (user_id, type, data) VALUES ($1, $2, $3)',
    [userId, type, JSON.stringify(data)]
  );
}

export { VALID_TYPES };
```

- [ ] **Step 2: Verify syntax**

Run: `node --check server/services/notifications.js`
Expected: No output (success)

- [ ] **Step 3: Commit**

```bash
git add server/services/notifications.js
git commit -m "feat: add centralized notify() service"
```

---

### Task 3: API Routes

**Files:**
- Create: `server/routes/notifications.js`
- Modify: `server/index.js` (add route registration at ~line 163)

- [ ] **Step 1: Create routes file**

```js
// server/routes/notifications.js
import { activeGuard } from '../middleware/auth-guard.js';

export default async function notificationRoutes(app) {
  app.addHook('preHandler', activeGuard);

  // List recent notifications + unread count
  app.get('/', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const userId = req.user?.id;
    if (!userId) return reply.code(401).send({ error: 'Not authenticated' });

    const [listRes, countRes] = await Promise.all([
      app.db.query(
        'SELECT id, type, data, read_at, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30',
        [userId]
      ),
      app.db.query(
        'SELECT COUNT(*)::int as count FROM notifications WHERE user_id = $1 AND read_at IS NULL',
        [userId]
      ),
    ]);

    reply.send({
      notifications: listRes.rows.map(n => ({
        id: n.id,
        type: n.type,
        data: n.data,
        readAt: n.read_at,
        createdAt: n.created_at,
      })),
      unreadCount: countRes.rows[0]?.count || 0,
    });
  });

  // Lightweight unread count for polling
  app.get('/count', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const userId = req.user?.id;
    if (!userId) return reply.code(401).send({ error: 'Not authenticated' });

    const { rows: [{ count }] } = await app.db.query(
      'SELECT COUNT(*)::int as count FROM notifications WHERE user_id = $1 AND read_at IS NULL',
      [userId]
    );

    reply.send({ unreadCount: count });
  });

  // Mark notifications as read
  app.post('/read', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const userId = req.user?.id;
    if (!userId) return reply.code(401).send({ error: 'Not authenticated' });

    const { ids, all } = req.body || {};

    if (all) {
      await app.db.query(
        'UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL',
        [userId]
      );
    } else if (Array.isArray(ids) && ids.length > 0) {
      await app.db.query(
        'UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL AND id = ANY($2)',
        [userId, ids]
      );
    }

    reply.send({ ok: true });
  });
}
```

- [ ] **Step 2: Register route in server/index.js**

Add after the last `app.register` line (~line 163):

```js
import notificationRoutes from './routes/notifications.js';
// ... in the register block:
app.register(notificationRoutes, { prefix: '/api/notifications' });
```

- [ ] **Step 3: Verify syntax**

Run: `node --check server/routes/notifications.js && node --check server/index.js`
Expected: No output (success)

- [ ] **Step 4: Commit**

```bash
git add server/routes/notifications.js server/index.js
git commit -m "feat: add notification API endpoints (list, count, read)"
```

---

## Chunk 2: Server-side Emission Points

### Task 4: Emit notifications from invites.js

**Files:**
- Modify: `server/services/invites.js`

- [ ] **Step 1: Add import**

At top of file, add:
```js
import { notify } from './notifications.js';
```

- [ ] **Step 2: Emit in `claimInvite()` — after atomic claim succeeds**

Expand the existing `claimer` query (currently `SELECT status, invited_by`) to include `name, email`:
```js
const { rows: [claimer] } = await db.query('SELECT status, invited_by, name, email FROM users WHERE id = $1', [userId]);
```

After the `generateInviteCodes` block (before `return`), add:
```js
  // Notify the code owner that their invite was claimed
  if (invite.owner_id) {
    notify(db, invite.owner_id, 'invite_claimed', {
      inviteeName: claimer?.name || claimer?.email || 'Un utente',
      code,
    }).catch(() => {});
  }
```

- [ ] **Step 3: Emit in `handleFirstGeneration()` — after COMMIT**

The notification must go AFTER `client.query('COMMIT')` but guarded by whether activation happened. Here's the exact restructured code for the transaction block in `handleFirstGeneration()`:

```js
    // Transaction: activate code + award credit + log
    const client = await db.pool ? db.pool.connect() : db.connect();
    let activatedCount = 0; // Track outside transaction scope
    try {
      await client.query('BEGIN');

      const activated = await client.query(
        'UPDATE invite_codes SET activated = true, activated_at = NOW() WHERE claimed_by = $1 AND NOT activated',
        [userId]
      );
      activatedCount = activated.rowCount;

      // Only award credit if we actually activated a code (prevents double-reward)
      if (activatedCount > 0) {
        await client.query(
          'UPDATE users SET credits = credits + $1 WHERE id = $2',
          [ACTIVATION_REWARD, invitedBy]
        );

        await client.query(
          `INSERT INTO credit_usage (user_id, action, credits_consumed) VALUES ($1, 'invite_reward', 0)`,
          [invitedBy]
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Notifications AFTER commit, using pool connection (not transaction client)
    if (activatedCount > 0) {
      const { rows: [invitee] } = await db.query('SELECT name, email FROM users WHERE id = $1', [userId]);
      const inviteeName = invitee?.name || invitee?.email || 'Un utente';
      notify(db, invitedBy, 'invite_activated', { inviteeName, credits: ACTIVATION_REWARD }).catch(() => {});
    }

    // Check for batch reload
    await checkBatchReload(db, invitedBy);
```

- [ ] **Step 4: Emit in `checkBatchReload()` — batch 2 generated**

Replace the `pending_gift` UPDATE for batch reload:
```js
// Replace: await db.query('UPDATE users SET pending_gift = $1 WHERE id = $2', [...]);
// With:
notify(db, ownerId, 'batch_reload', { newCodes: BATCH_2_SIZE }).catch(() => {});
```

- [ ] **Step 5: Emit in `checkBatchReload()` — completion bonus**

Replace the `pending_gift` UPDATE for completion:
```js
// Replace: await db.query('UPDATE users SET pending_gift = $1 WHERE id = $2', [...]);
// With:
notify(db, ownerId, 'referral_complete', { credits: COMPLETION_BONUS }).catch(() => {});
```

- [ ] **Step 6: Verify syntax**

Run: `node --check server/services/invites.js`
Expected: No output

- [ ] **Step 7: Commit**

```bash
git add server/services/invites.js
git commit -m "feat: emit notifications from invite lifecycle events"
```

---

### Task 5: Emit notifications from admin.js, feedback.js, payments.js

**Files:**
- Modify: `server/routes/admin.js`
- Modify: `server/routes/feedback.js`
- Modify: `server/routes/payments.js`

- [ ] **Step 1: admin.js — credit changes**

Add import at top:
```js
import { notify } from '../services/notifications.js';
```

At the PUT `/users/:id/credits` handler (~line 216), replace the `pending_gift` UPDATE with:
```js
if (diff > 0) {
  notify(app.db, req.params.id, 'credits_received', { credits: diff, reason: reason || null }).catch(() => {});
}
```

Remove the `UPDATE users SET pending_gift = ...` line.

- [ ] **Step 2: admin.js — waitlist activation**

At PUT `/users/:id/activate` (~line 236), after the user is activated and credits awarded, add:
```js
notify(app.db, req.params.id, 'welcome_activated', { credits: WELCOME_CREDITS }).catch(() => {});
```

At POST `/waitlist/:id/activate` (~line 354), after the user is created/activated, add the same:
```js
notify(app.db, userId, 'welcome_activated', { credits: WELCOME_CREDITS }).catch(() => {});
```

- [ ] **Step 3: feedback.js — reward**

Add import at top:
```js
import { notify } from '../services/notifications.js';
```

At POST `/feedback/admin/:id/reward` (~line 76), after credits are awarded, add:
```js
notify(app.db, entry.user_id, 'feedback_rewarded', { credits, note: note || null }).catch(() => {});
```
Note: the handler destructures `{ credits, note }` from `req.body` — use `note`, not `admin_note`.

- [ ] **Step 4: payments.js — Stripe success**

Add import at top:
```js
import { notify } from '../services/notifications.js';
```

At the Stripe webhook handler (~line 104), after `addCredits()` succeeds (inside the try block), add:
```js
import { PRICING_TIERS } from '../services/credits.js';
// ... inside the webhook handler, after addCredits:
const tierCredits = PRICING_TIERS[tier]?.credits || 0;
notify(app.db, userId, 'credits_purchased', { credits: tierCredits, tier }).catch(() => {});
```
Note: `PRICING_TIERS` import goes at the top of the file. `tier` and `userId` are already in scope from `session.metadata`.

- [ ] **Step 5: Verify syntax for all 3 files**

Run: `node --check server/routes/admin.js && node --check server/routes/feedback.js && node --check server/routes/payments.js`
Expected: No output

- [ ] **Step 6: Commit**

```bash
git add server/routes/admin.js server/routes/feedback.js server/routes/payments.js
git commit -m "feat: emit notifications from admin, feedback, and payment events"
```

---

## Chunk 3: Frontend

### Task 6: API methods + strings

**Files:**
- Modify: `client/src/api.js`
- Modify: `client/src/strings.js`

- [ ] **Step 1: Add API methods in `client/src/api.js`**

Add after the existing invite system methods (~line 84):
```js
  // Notifications
  getNotifications: () => request('/notifications'),
  getNotificationCount: () => request('/notifications/count'),
  markNotificationsRead: (body) => request('/notifications/read', { method: 'POST', body }),
```

- [ ] **Step 2: Add notification strings in `client/src/strings.js`**

Add before the `common:` section (~line 312):
```js
  notifications: {
    title: 'Notifiche',
    empty: 'Nessuna notifica',
    invite_claimed:    (d) => `${d.inviteeName} ha accettato il tuo invito`,
    invite_activated:  (d) => `${d.inviteeName} ha generato il primo CV — +${d.credits} credito`,
    batch_reload:      (d) => `Hai ${d.newCodes} nuovi inviti disponibili!`,
    referral_complete: (d) => `Tutti i tuoi inviti sono attivi — +${d.credits} crediti bonus!`,
    credits_received:  (d) => `Hai ricevuto ${d.credits} crediti${d.reason ? `: "${d.reason}"` : ''}`,
    credits_purchased: (d) => `Acquisto completato: +${d.credits} crediti`,
    feedback_rewarded: (d) => `Il tuo feedback è stato premiato con ${d.credits} crediti`,
    welcome_activated: (d) => `Benvenuto! Il tuo account è attivo — hai ${d.credits} crediti`,
  },
```

- [ ] **Step 3: Commit**

```bash
git add client/src/api.js client/src/strings.js
git commit -m "feat: add notification API methods and strings"
```

---

### Task 7: Add missing icons to Icon.jsx

**Files:**
- Modify: `client/src/components/Icon.jsx`

Existing icons: `sun, moon, x, mail, phone, coins, shield-ban, file-text, clock, file-up, download, copy, check, trash, edit, search, file-x, check-circle, rocket, map-pin, layout-grid, users, message-circle, alert-triangle`

**Missing icons needed:** `user-plus`, `gift`, `trophy`, `credit-card`, `sparkles`, `bell`

- [ ] **Step 1: Add missing icon SVG paths**

Open `Icon.jsx` and add to the icons map:
- `bell` — notification bell
- `user-plus` — invite claimed
- `gift` — batch reload
- `trophy` — referral complete
- `credit-card` — purchase
- `sparkles` — welcome

All icons use Lucide icon SVG paths (same as existing icons in the file). Copy the `d` attribute from https://lucide.dev for each icon.

- [ ] **Step 2: Commit**

```bash
git add client/src/components/Icon.jsx
git commit -m "feat: add bell, user-plus, gift, trophy, credit-card, sparkles icons"
```

---

### Task 8: NotificationBell component

**Files:**
- Create: `client/src/components/NotificationBell.jsx`

- [ ] **Step 1: Create the component**

```jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api';
import { t } from '../strings';
import Icon from './Icon';

const POLL_INTERVAL = 60_000;

// Relative time formatter
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ora';
  if (mins < 60) return `${mins}m fa`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h fa`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'ieri';
  if (days < 7) return `${days}g fa`;
  return new Date(dateStr).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

const TYPE_ICONS = {
  invite_claimed: { icon: 'user-plus', color: 'var(--color-success, #00E676)' },
  invite_activated: { icon: 'check-circle', color: 'var(--color-success, #00E676)' },
  batch_reload: { icon: 'gift', color: 'var(--color-accent, #448AFF)' },
  referral_complete: { icon: 'trophy', color: '#FFD600' },
  credits_received: { icon: 'coins', color: 'var(--color-success, #00E676)' },
  credits_purchased: { icon: 'credit-card', color: '#448AFF' },
  feedback_rewarded: { icon: 'message-circle', color: 'var(--color-accent, #448AFF)' },
  welcome_activated: { icon: 'sparkles', color: '#FFD600' },
};

function getNotificationText(type, data) {
  const fn = t(`notifications.${type}`);
  return typeof fn === 'function' ? fn(data) : type;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.getNotifications();
      setNotifications(res.notifications || []);
      setUnreadCount(res.unreadCount || 0);
    } catch { /* silent */ }
  }, []);

  const pollCount = useCallback(async () => {
    try {
      const res = await api.getNotificationCount();
      const newCount = res.unreadCount || 0;
      setUnreadCount(prev => {
        if (newCount > prev) fetchNotifications(); // new notifications arrived, refetch list
        return newCount;
      });
    } catch { /* silent */ }
  }, [fetchNotifications]);

  // Initial fetch + polling
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(pollCount, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchNotifications, pollCount]);

  // Mark all as read when dropdown opens
  useEffect(() => {
    if (open && unreadCount > 0) {
      api.markNotificationsRead({ all: true }).catch(() => {});
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
    }
  }, [open, unreadCount]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="notification-bell-wrap" ref={ref}>
      <button className="notification-bell-btn" onClick={() => setOpen(o => !o)} aria-label="Notifiche">
        <Icon name="bell" size={20} />
        {unreadCount > 0 && <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="notification-dropdown">
          <div className="notification-dropdown-header">{t('notifications.title')}</div>
          {notifications.length === 0 ? (
            <div className="notification-empty">{t('notifications.empty')}</div>
          ) : (
            <div className="notification-list">
              {notifications.map(n => {
                const typeInfo = TYPE_ICONS[n.type] || { icon: 'bell', color: '#888' };
                return (
                  <div key={n.id} className={`notification-item${n.readAt ? '' : ' unread'}`}>
                    <div className="notification-icon" style={{ color: typeInfo.color }}>
                      <Icon name={typeInfo.icon} size={16} />
                    </div>
                    <div className="notification-content">
                      <span className="notification-text">{getNotificationText(n.type, n.data)}</span>
                      <span className="notification-time">{timeAgo(n.createdAt)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/NotificationBell.jsx
git commit -m "feat: add NotificationBell component with dropdown"
```

---

### Task 9: Integrate bell into Header + CSS

**Files:**
- Modify: `client/src/components/Header.jsx` (~line 89)
- Modify: `client/css/app.css`

- [ ] **Step 1: Add NotificationBell to Header.jsx**

Import at top:
```js
import NotificationBell from './NotificationBell';
```

Insert `<NotificationBell />` between the credit badge and the avatar in the `app-user-area` div (~between lines 89 and 91):
```jsx
{/* After credit badge, before avatar */}
{!user.guest && <NotificationBell />}
```

- [ ] **Step 2: Add CSS for bell and dropdown**

Add to `client/css/app.css` (after the invite error popup styles, before the admin section):

```css
/* ── Notification Bell ── */
.notification-bell-wrap {
  position: relative;
}
.notification-bell-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-secondary, rgba(255,255,255,0.7));
  padding: 6px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  position: relative;
  transition: color 0.2s;
}
.notification-bell-btn:hover {
  color: var(--text-primary, #fff);
}
.notification-badge {
  position: absolute;
  top: 2px;
  right: 0;
  background: #ff5252;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  line-height: 1;
}
.notification-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 320px;
  max-height: 400px;
  background: rgba(10, 10, 10, 0.85);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--radius-lg, 16px);
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  z-index: 1000;
  overflow: hidden;
  animation: giftFadeIn 0.2s ease;
}
[data-theme="light"] .notification-dropdown {
  background: rgba(255,255,255,0.9);
  border-color: rgba(0,0,0,0.1);
  box-shadow: 0 8px 32px rgba(0,0,0,0.12);
}
.notification-dropdown-header {
  padding: 12px 16px;
  font-weight: 600;
  font-size: 0.9rem;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  color: var(--text-primary, #fff);
}
[data-theme="light"] .notification-dropdown-header {
  border-bottom-color: rgba(0,0,0,0.08);
}
.notification-list {
  overflow-y: auto;
  max-height: 340px;
}
.notification-item {
  display: flex;
  gap: 10px;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  transition: background 0.15s;
}
.notification-item.unread {
  background: rgba(68, 138, 255, 0.08);
}
[data-theme="light"] .notification-item.unread {
  background: rgba(68, 138, 255, 0.06);
}
.notification-icon {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(255,255,255,0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 2px;
}
[data-theme="light"] .notification-icon {
  background: rgba(0,0,0,0.05);
}
.notification-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.notification-text {
  font-size: 0.85rem;
  color: var(--text-primary, #fff);
  line-height: 1.35;
}
.notification-time {
  font-size: 0.75rem;
  color: var(--text-secondary, rgba(255,255,255,0.5));
}
.notification-empty {
  padding: 24px 16px;
  text-align: center;
  color: var(--text-secondary, rgba(255,255,255,0.5));
  font-size: 0.85rem;
}

/* Mobile: full-width dropdown */
@media (max-width: 480px) {
  .notification-dropdown {
    width: calc(100vw - 24px);
    right: -60px;
  }
}
```

- [ ] **Step 3: Verify no syntax errors**

Run: `node --check client/src/api.js`
Expected: No output

- [ ] **Step 4: Commit**

```bash
git add client/src/components/Header.jsx client/src/components/NotificationBell.jsx client/css/app.css
git commit -m "feat: integrate notification bell into header with dropdown UI"
```

---

## Chunk 4: Deprecate pending_gift

### Task 10: Remove pending_gift writes + update GiftNotification trigger

**Files:**
- Modify: `server/services/invites.js` (remove pending_gift writes — already done in Task 4)
- Modify: `server/routes/admin.js` (remove pending_gift write — already done in Task 5)
- Modify: `server/routes/payments.js` (stop reading/clearing pending_gift)
- Modify: `client/src/components/Header.jsx` (trigger GiftNotification from notifications)

- [ ] **Step 1: Remove pending_gift from balance endpoint**

In `server/routes/payments.js`, find the `GET /balance` handler where it reads `pending_gift` and clears it. Remove those lines. The `gift` field in the response should be removed or always null.

- [ ] **Step 2: Update Header.jsx GiftNotification trigger**

The GiftNotification should now be triggered when `getNotifications()` returns unread `batch_reload` or `referral_complete` notifications. Add logic after the initial `fetchNotifications` in NotificationBell to check for these types and show GiftNotification if found.

In `NotificationBell.jsx`, after the initial fetch:
```js
// In fetchNotifications callback, after setNotifications:
const giftNotif = (res.notifications || []).find(
  n => !n.readAt && (n.type === 'batch_reload' || n.type === 'referral_complete')
);
if (giftNotif) {
  setGiftData(giftNotif.type === 'batch_reload'
    ? { credits: 0, reason: `${giftNotif.data.newCodes} nuovi inviti sbloccati!` }
    : { credits: giftNotif.data.credits, reason: 'Tutti i tuoi inviti sono attivi!' });
}
```

Add state and render GiftNotification:
```jsx
const [giftData, setGiftData] = useState(null);

// In JSX, after the dropdown:
{giftData && <GiftNotification gift={giftData} onClose={() => setGiftData(null)} />}
```

Import:
```js
import GiftNotification from './GiftNotification';
```

- [ ] **Step 3: Commit**

```bash
git add server/routes/payments.js client/src/components/NotificationBell.jsx client/src/components/Header.jsx
git commit -m "feat: deprecate pending_gift, trigger GiftNotification from notifications"
```

---

## Post-Implementation

After all tasks complete:
1. Run systematic debugging on all notification flows
2. Test visual design with Playwright on iPhone 15 Pro layout
