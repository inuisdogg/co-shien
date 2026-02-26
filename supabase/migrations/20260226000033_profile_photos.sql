-- Add profile photo URL to users (may already exist from previous migration)
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;

-- Resume uploads table
CREATE TABLE IF NOT EXISTS resume_uploads (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  upload_type TEXT DEFAULT 'resume', -- 'resume', 'cv', 'certificate'
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE resume_uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "resume_uploads_all" ON resume_uploads FOR ALL USING (true) WITH CHECK (true);
