-- Admin panel: role, error logs, audit logs

ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';

CREATE TABLE IF NOT EXISTS error_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level         VARCHAR(10) NOT NULL DEFAULT 'error',
  endpoint      VARCHAR(200),
  message       TEXT NOT NULL,
  stack         TEXT,
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  request_body  JSONB,
  status_code   INTEGER,
  created_at    TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_error_logs_level ON error_logs (level);

CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  action        VARCHAR(50) NOT NULL,
  ip            VARCHAR(45),
  user_agent    VARCHAR(500),
  metadata      JSONB,
  created_at    TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);
