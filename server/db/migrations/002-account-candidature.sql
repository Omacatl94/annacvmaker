-- Users: master profile data + preferences
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS location VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';

-- Generated CVs: candidature tracking
ALTER TABLE generated_cvs ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'sent';
ALTER TABLE generated_cvs ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
ALTER TABLE generated_cvs ADD COLUMN IF NOT EXISTS location VARCHAR(255);
