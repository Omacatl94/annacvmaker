-- Add OAuth fields to waitlist so Google/LinkedIn signups go here instead of creating ghost users
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS name VARCHAR(200);
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS linkedin_id VARCHAR(255);

-- Clean up: remove ghost users that were created with status='waitlist' (old flow)
-- Their data is now in the waitlist table
DELETE FROM users WHERE status = 'waitlist';
