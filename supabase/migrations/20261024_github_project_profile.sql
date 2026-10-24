-- Migration: GitHub Repository Integration and Project Profile Columns
-- Adds repository, branch, commit SHA, and language metadata to collaborative rooms

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS repository_url TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS branch TEXT DEFAULT 'main';
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS commit_sha TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS primary_language TEXT DEFAULT 'Plain Text';

CREATE INDEX IF NOT EXISTS idx_rooms_repository_url ON rooms(repository_url);
