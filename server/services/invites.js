// server/services/invites.js
import crypto from 'node:crypto';

export const BATCH_1_SIZE = 3;
export const BATCH_2_SIZE = 3;
export const WELCOME_CREDITS = 2;
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
