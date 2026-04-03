-- 013-pdf-cache.sql
ALTER TABLE generated_cvs ADD COLUMN IF NOT EXISTS pdf_path TEXT;
