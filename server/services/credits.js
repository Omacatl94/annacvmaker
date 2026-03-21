// Credits service — balance, consumption, purchasing logic
import { config } from '../config.js';

export const PRICING_TIERS = {
  starter: { credits: 5, price_cents: 499, label: 'Starter — 5 CV' },
  pro:     { credits: 20, price_cents: 1499, label: 'Pro — 20 CV' },
  blitz:   { credits: 55, price_cents: 2999, label: 'Blitz — 55 CV' },
  arsenal: { credits: 115, price_cents: 4999, label: 'Arsenal — 115 CV', hidden: true },
};

export const CREDIT_COSTS = {
  cv_generation: 1,
  cover_letter: 1,
  cv_rewrite: 2,
};

/**
 * Count how many credits the user has consumed today.
 */
async function getDailyUsage(db, userId) {
  const { rows } = await db.query(
    `SELECT COALESCE(SUM(credits_consumed), 0) AS used
     FROM credit_usage
     WHERE user_id = $1 AND created_at >= CURRENT_DATE`,
    [userId],
  );
  return parseInt(rows[0].used, 10);
}

/**
 * Get credit balance for a user.
 * In open beta, also returns daily usage info.
 * @returns {{ credits: number, expiry: string|null, openBeta?: boolean, dailyUsed?: number, dailyLimit?: number }}
 */
export async function getBalance(db, userId) {
  const { rows } = await db.query(
    'SELECT credits, credits_expiry FROM users WHERE id = $1',
    [userId],
  );
  if (!rows.length) {
    const err = new Error('Utente non trovato');
    err.statusCode = 404;
    throw err;
  }

  const result = {
    credits: rows[0].credits,
    expiry: rows[0].credits_expiry ? rows[0].credits_expiry.toISOString() : null,
  };

  if (config.openBeta) {
    const dailyUsed = await getDailyUsage(db, userId);
    result.openBeta = true;
    result.dailyUsed = dailyUsed;
    result.dailyLimit = config.openBetaDailyLimit;
  }

  return result;
}

/**
 * Check whether the user can afford a given action.
 * In open beta: checks daily quota instead of credit balance.
 */
export async function hasCredits(db, userId, action) {
  const cost = CREDIT_COSTS[action];
  if (!cost) return true;

  if (config.openBeta) {
    const dailyUsed = await getDailyUsage(db, userId);
    if (dailyUsed + cost <= config.openBetaDailyLimit) return true;
    // Daily quota exhausted — fall back to credit balance (from referrals)
    const { credits } = await getBalance(db, userId);
    return credits >= cost;
  }

  const { credits } = await getBalance(db, userId);
  return credits >= cost;
}

/**
 * Atomically consume credits for an action.
 * In open beta: logs usage but does NOT deduct from balance.
 * @returns {number} remaining credits (or daily remaining in beta)
 */
export async function consumeCredits(db, userId, action, generatedCvId = null) {
  const cost = CREDIT_COSTS[action];
  if (!cost) return (await getBalance(db, userId)).credits;

  if (config.openBeta) {
    const dailyUsed = await getDailyUsage(db, userId);

    if (dailyUsed + cost <= config.openBetaDailyLimit) {
      // Free daily quota — log usage, don't deduct from balance
      await db.query(
        `INSERT INTO credit_usage (user_id, action, credits_consumed, generated_cv_id)
         VALUES ($1, $2, $3, $4)`,
        [userId, action, cost, generatedCvId],
      );
      return config.openBetaDailyLimit - dailyUsed - cost;
    }

    // Daily quota exhausted — use credit balance (from referrals)
    const { rows } = await db.query(
      `UPDATE users SET credits = credits - $1
       WHERE id = $2 AND credits >= $1
       RETURNING credits`,
      [cost, userId],
    );

    if (!rows.length) {
      const err = new Error('Limite giornaliero raggiunto');
      err.statusCode = 402;
      throw err;
    }

    await db.query(
      `INSERT INTO credit_usage (user_id, action, credits_consumed, generated_cv_id)
       VALUES ($1, $2, $3, $4)`,
      [userId, action, cost, generatedCvId],
    );

    return rows[0].credits;
  }

  // Normal flow: deduct from balance
  const { rows } = await db.query(
    `UPDATE users
        SET credits = credits - $1
      WHERE id = $2 AND credits >= $1
  RETURNING credits`,
    [cost, userId],
  );

  if (!rows.length) {
    const err = new Error('Crediti insufficienti');
    err.statusCode = 402;
    throw err;
  }

  await db.query(
    `INSERT INTO credit_usage (user_id, action, credits_consumed, generated_cv_id)
     VALUES ($1, $2, $3, $4)`,
    [userId, action, cost, generatedCvId],
  );

  return rows[0].credits;
}

/**
 * Add purchased credits to a user and record the purchase.
 * @returns {{ credits: number, expiry: string }}
 */
export async function addCredits(db, userId, tier, stripeSessionId, stripePaymentIntent) {
  const tierData = PRICING_TIERS[tier];
  if (!tierData) {
    const err = new Error(`Tier non valido: ${tier}`);
    err.statusCode = 400;
    throw err;
  }

  const { rows } = await db.query(
    `UPDATE users
        SET credits = credits + $1,
            credits_expiry = GREATEST(COALESCE(credits_expiry, NOW()), NOW()) + INTERVAL '24 months'
      WHERE id = $2
  RETURNING credits, credits_expiry`,
    [tierData.credits, userId],
  );

  if (!rows.length) {
    const err = new Error('Utente non trovato');
    err.statusCode = 404;
    throw err;
  }

  await db.query(
    `INSERT INTO purchases (user_id, tier, credits_added, amount_cents, stripe_session_id, stripe_payment_intent)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, tier, tierData.credits, tierData.price_cents, stripeSessionId, stripePaymentIntent],
  );

  return {
    credits: rows[0].credits,
    expiry: rows[0].credits_expiry.toISOString(),
  };
}
