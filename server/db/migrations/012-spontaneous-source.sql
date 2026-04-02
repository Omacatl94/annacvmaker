-- 012-spontaneous-source.sql
ALTER TABLE generated_cvs
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) DEFAULT 'job_description',
  ADD COLUMN IF NOT EXISTS source_url TEXT;
