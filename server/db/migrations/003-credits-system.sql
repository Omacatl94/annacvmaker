-- Credits system: user balance, purchases, usage tracking

-- Users: add credits balance and expiry
ALTER TABLE users ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS credits_expiry TIMESTAMP DEFAULT (NOW() + INTERVAL '24 months');

-- Purchases table (Stripe integration)
CREATE TABLE IF NOT EXISTS purchases (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier                  VARCHAR(20) NOT NULL,
  credits_added         INTEGER NOT NULL,
  amount_cents          INTEGER NOT NULL,
  currency              VARCHAR(3) NOT NULL DEFAULT 'EUR',
  stripe_session_id     VARCHAR(255),
  stripe_payment_intent VARCHAR(255),
  status                VARCHAR(20) NOT NULL DEFAULT 'completed',
  created_at            TIMESTAMP DEFAULT NOW()
);

-- Credit usage ledger
CREATE TABLE IF NOT EXISTS credit_usage (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action            VARCHAR(50) NOT NULL,
  credits_consumed  INTEGER NOT NULL DEFAULT 1,
  generated_cv_id   UUID REFERENCES generated_cvs(id) ON DELETE SET NULL,
  created_at        TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases (user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_stripe_session ON purchases (stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_credit_usage_user ON credit_usage (user_id);
