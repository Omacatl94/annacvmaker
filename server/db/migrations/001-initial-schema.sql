CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  name          VARCHAR(255),
  google_id     VARCHAR(255) UNIQUE,
  linkedin_id   VARCHAR(255) UNIQUE,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE cv_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  label         VARCHAR(100) DEFAULT 'CV Principale',
  personal      JSONB NOT NULL DEFAULT '{}',
  photo_path    VARCHAR(500),
  experiences   JSONB NOT NULL DEFAULT '[]',
  education     JSONB NOT NULL DEFAULT '[]',
  skills        JSONB NOT NULL DEFAULT '[]',
  languages     JSONB NOT NULL DEFAULT '[]',
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE generated_cvs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    UUID REFERENCES cv_profiles(id) ON DELETE CASCADE,
  job_description TEXT NOT NULL,
  target_role   VARCHAR(255),
  target_company VARCHAR(255),
  language      VARCHAR(2) NOT NULL DEFAULT 'it',
  style         VARCHAR(20) NOT NULL DEFAULT 'professional',
  generated_data JSONB NOT NULL,
  ats_classic   INTEGER,
  ats_smart     INTEGER,
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE sessions (
  sid           VARCHAR(255) PRIMARY KEY,
  sess          JSONB NOT NULL,
  expire        TIMESTAMP NOT NULL
);
CREATE INDEX idx_sessions_expire ON sessions (expire);
CREATE INDEX idx_cv_profiles_user ON cv_profiles (user_id);
CREATE INDEX idx_generated_cvs_profile ON generated_cvs (profile_id);
