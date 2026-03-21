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
