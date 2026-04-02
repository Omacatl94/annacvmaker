# Notification System — Design Spec

**Date:** 2026-03-14
**Status:** Approved

## Overview

Sistema di notifiche in-app per tracciare eventi utente: inviti accettati/attivati, crediti ricevuti, premi feedback, acquisti. Sostituisce il pattern `pending_gift` con un sistema persistente e scalabile.

## Decisions

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Delivery | Polling (60s count, full list on open) | No WebSocket/SSE infra exists |
| UI | Bell icon in Header + dropdown | Always visible, minimal footprint |
| Persistence | DB table with `read_at` flag | Survives multiple events, reviewable |
| Granularity | 1 event = 1 notification | Low volume (~10 types, max 20/user/month) |
| Architecture | Centralized `notify()` service | Follows existing pattern (credits.js, invites.js) |
| Text rendering | Frontend-side from `type` + `data` | Localizable, no UI strings in DB |

## Database Schema

```sql
-- Migration: 010-notifications.sql

CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(50) NOT NULL,
  data       JSONB NOT NULL DEFAULT '{}',
  read_at    TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_unread
  ON notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;
```

**Design notes:**
- `type` is a free string, not a DB enum — adding types requires no migration
- `data` is JSONB — each type has its own schema
- Partial index on unread optimizes the most frequent query (badge count)
- No `title`/`message` columns — text is generated client-side from `type` + `data`

## Notification Types

| Type | Recipient | Data Schema | Trigger Point |
|------|-----------|-------------|---------------|
| `invite_claimed` | Inviter (code owner) | `{ inviteeName: string, code: string }` | `claimInvite()` success |
| `invite_activated` | Inviter | `{ inviteeName: string, credits: number }` | `handleFirstGeneration()` rowCount > 0 |
| `batch_reload` | Code owner | `{ newCodes: number }` | `checkBatchReload()` batch 2 generated |
| `referral_complete` | Code owner | `{ credits: number }` | `checkBatchReload()` all 6 activated |
| `credits_received` | Target user | `{ credits: number, reason?: string }` | Admin credit adjustment |
| `credits_purchased` | Buyer | `{ credits: number, tier: string }` | Stripe webhook success |
| `feedback_rewarded` | Feedback author | `{ credits: number, note?: string }` | Admin rewards feedback |
| `welcome_activated` | Activated user | `{ credits: number }` | Admin activates from waitlist |

## Server Service

### `server/services/notifications.js`

```js
const VALID_TYPES = new Set([
  'invite_claimed', 'invite_activated', 'batch_reload', 'referral_complete',
  'credits_received', 'credits_purchased', 'feedback_rewarded', 'welcome_activated',
]);

export async function notify(db, userId, type, data = {}) {
  if (!VALID_TYPES.has(type)) return;
  await db.query(
    'INSERT INTO notifications (user_id, type, data) VALUES ($1, $2, $3)',
    [userId, type, JSON.stringify(data)]
  );
}
```

Fire-and-forget pattern: callers should `.catch(() => {})` if the notification must not block the main operation.

## API Endpoints

**Authentication:** All `/api/notifications/*` endpoints require authentication (`req.user.id`). All queries are scoped to the authenticated user's ID — never accept user ID from request body/params (prevents IDOR).

**Rate limiting:** `GET /notifications/count` → 60/min. `GET /notifications` → 30/min. `POST /notifications/read` → 30/min.

### `GET /api/notifications`

Returns last 30 notifications (read + unread) + total unread count.

```json
{
  "notifications": [
    { "id": "uuid", "type": "invite_claimed", "data": { "inviteeName": "Anna" }, "readAt": null, "createdAt": "2026-03-14T10:00:00Z" }
  ],
  "unreadCount": 3
}
```

Query: `SELECT ... FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30`
Count: `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read_at IS NULL`

### `GET /api/notifications/count`

Lightweight polling endpoint. Returns only the count.

```json
{ "unreadCount": 3 }
```

Called every 60s by the frontend. Single query on partial index.

### `POST /api/notifications/read`

Mark notifications as read.

```json
// Specific notifications
{ "ids": ["uuid1", "uuid2"] }

// All notifications
{ "all": true }
```

Query: `UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL [AND id = ANY($2)]`

## Frontend Components

### Header.jsx — Bell icon with badge

- Bell icon positioned near theme toggle
- Red badge with `unreadCount` when > 0, hidden when 0
- Click toggles `NotificationDropdown`
- Fetches `GET /notifications` on mount
- Polls `GET /notifications/count` every 60s via `setInterval`
- If count changes → refetch full list

### NotificationDropdown.jsx — Inline dropdown

- Positioned absolutely below the bell icon
- Scrollable list, max 30 items
- Each row: type icon + generated text + relative timestamp ("2h fa", "ieri")
- Unread items: slightly highlighted background
- On open: auto-sends `POST /notifications/read { all: true }`
- Empty state: "Nessuna notifica"
- Click outside → close

### strings.js — Notification text generators

```js
notifications: {
  invite_claimed:    (d) => `${d.inviteeName} ha accettato il tuo invito`,
  invite_activated:  (d) => `${d.inviteeName} ha generato il primo CV — +${d.credits} credito`,
  batch_reload:      (d) => `Hai ${d.newCodes} nuovi inviti disponibili!`,
  referral_complete: (d) => `Tutti i tuoi inviti sono attivi — +${d.credits} crediti bonus!`,
  credits_received:  (d) => `Hai ricevuto ${d.credits} crediti${d.reason ? `: "${d.reason}"` : ''}`,
  credits_purchased: (d) => `Acquisto completato: +${d.credits} crediti`,
  feedback_rewarded: (d) => `Il tuo feedback è stato premiato con ${d.credits} crediti`,
  welcome_activated: (d) => `Benvenuto! Il tuo account è attivo — hai ${d.credits} crediti`,
}
```

## Emission Points (8 total, 4 files)

### `server/services/invites.js` (4 points)

1. **`claimInvite()`** — after atomic claim succeeds. The existing `claimer` query must be expanded to include `name, email`:
   ```js
   // Expand existing query: SELECT status, invited_by, name, email FROM users WHERE id = $1
   notify(db, invite.owner_id, 'invite_claimed', { inviteeName: claimer.name || claimer.email || 'Un utente', code })
     .catch(() => {});
   ```

2. **`handleFirstGeneration()`** — **after COMMIT** (not inside the transaction), still guarded by `activated.rowCount > 0`. Must fetch invitee name first:
   ```js
   // After COMMIT, outside transaction — fetch invitee name for notification
   const { rows: [invitee] } = await db.query('SELECT name, email FROM users WHERE id = $1', [userId]);
   const inviteeName = invitee?.name || invitee?.email || 'Un utente';
   notify(db, invitedBy, 'invite_activated', { inviteeName, credits: ACTIVATION_REWARD })
     .catch(() => {});
   ```
   **Important:** `notify()` uses the pool connection (`db`), not the transaction `client`. Emitting after COMMIT ensures no orphan notifications on rollback.

3. **`checkBatchReload()`** — when batch 2 generated:
   ```js
   notify(db, ownerId, 'batch_reload', { newCodes: BATCH_2_SIZE }).catch(() => {});
   ```
   Replaces: `UPDATE users SET pending_gift = '{"type":"invite_reload"...}'`

4. **`checkBatchReload()`** — completion bonus:
   ```js
   notify(db, ownerId, 'referral_complete', { credits: COMPLETION_BONUS }).catch(() => {});
   ```
   Replaces: `UPDATE users SET pending_gift = '{"type":"referral_complete"...}'`

### `server/routes/admin.js` (3 points)

5. **PUT `/users/:id/credits`** — when credits increase (diff > 0):
   ```js
   notify(app.db, userId, 'credits_received', { credits: diff, reason }).catch(() => {});
   ```
   Replaces: `UPDATE users SET pending_gift = ...`

6. **PUT `/users/:id/activate`** and **POST `/waitlist/:id/activate`**:
   ```js
   notify(app.db, userId, 'welcome_activated', { credits: WELCOME_CREDITS }).catch(() => {});
   ```

### `server/routes/feedback.js` (1 point)

7. **POST `/feedback/admin/:id/reward`**:
   ```js
   notify(app.db, entry.user_id, 'feedback_rewarded', { credits, note: admin_note }).catch(() => {});
   ```

### `server/routes/payments.js` (1 point)

8. **Stripe webhook success handler**:
   ```js
   notify(app.db, userId, 'credits_purchased', { credits, tier }).catch(() => {});
   ```

## Deprecation: `pending_gift`

- The 3 lines that currently write `pending_gift` (invites.js ×2, admin.js ×1) are replaced by `notify()` calls
- `pending_gift` column remains in DB (no destructive migration) but is no longer written to
- `GiftNotification` trigger: when `GET /notifications` returns an unread notification of type `batch_reload` or `referral_complete`, the frontend auto-shows `GiftNotification` with the data from that notification **before** marking it as read. This happens on the initial fetch (mount), not on polling count changes.
- The `GET /payments/balance` endpoint stops reading/clearing `pending_gift`

## Notification Icons (per type)

| Type | Icon | Color |
|------|------|-------|
| `invite_claimed` | user-plus | green |
| `invite_activated` | check-circle | green |
| `batch_reload` | gift | accent |
| `referral_complete` | trophy | gold |
| `credits_received` | coins | green |
| `credits_purchased` | credit-card | blue |
| `feedback_rewarded` | message-circle | accent |
| `welcome_activated` | sparkles | gold |

## Data Flow

```
1. Event occurs (e.g., invite claimed)
2. Server calls notify(db, userId, type, data)
3. Row inserted into notifications table
4. Client polls GET /notifications/count every 60s
5. Count changes → badge updates on bell icon
6. User clicks bell → GET /notifications → dropdown renders
7. Dropdown opens → POST /notifications/read { all: true }
8. Badge clears
```

## Maintenance

**Retention policy:** notifications older than 6 months are pruned. Add to migration:
```sql
-- Optional: run periodically via cron or app startup
-- DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '6 months';
```
Implementation: a simple cleanup query at server startup or via a scheduled job. Not critical for launch — the table grows slowly (~20 rows/user/month).

## Not In Scope

- Email notifications (future enhancement)
- Push notifications (future enhancement)
- Notification preferences/muting (unnecessary at current volume)
- Aggregation (low event volume doesn't justify)
- Account page history tab (can be added later using same table)
