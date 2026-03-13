-- Referral system: codes, tracking, credits

-- Users: add referral code column
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(6);

-- Generate referral codes for existing users
UPDATE users SET referral_code = UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 6))
WHERE referral_code IS NULL;

-- Referrals tracking table
CREATE TABLE IF NOT EXISTS referrals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credits_awarded INTEGER NOT NULL DEFAULT 2,
  created_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE (referred_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals (referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals (referred_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users (referral_code);
