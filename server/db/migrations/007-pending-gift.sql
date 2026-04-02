-- Pending gift notification for admin credit changes
ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_gift JSONB;
