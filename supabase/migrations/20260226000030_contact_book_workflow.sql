-- Contact Book Workflow: create contact_logs if missing, add status + push subscriptions

-- Create contact_logs table if it doesn't exist (may have been skipped)
CREATE TABLE IF NOT EXISTS contact_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL,
  child_id TEXT NOT NULL,
  schedule_id TEXT,
  date DATE NOT NULL,
  slot TEXT,
  activities TEXT,
  health_status TEXT,
  mood TEXT,
  appetite TEXT,
  meal_main BOOLEAN DEFAULT false,
  meal_side BOOLEAN DEFAULT false,
  meal_notes TEXT,
  toilet_count INTEGER DEFAULT 0,
  toilet_notes TEXT,
  nap_start_time TIME,
  nap_end_time TIME,
  nap_notes TEXT,
  staff_comment TEXT,
  staff_user_id TEXT,
  parent_message TEXT,
  parent_reply TEXT,
  parent_reply_at TIMESTAMPTZ,
  is_signed BOOLEAN DEFAULT false,
  signed_at TIMESTAMPTZ,
  signed_by_user_id TEXT,
  signature_data TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

-- Add status to contact_logs (draft/submitted/signed)
ALTER TABLE contact_logs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';

-- Add parentSignerName column for tracking who signed
ALTER TABLE contact_logs ADD COLUMN IF NOT EXISTS parent_signer_name TEXT;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contact_logs_facility_id ON contact_logs(facility_id);
CREATE INDEX IF NOT EXISTS idx_contact_logs_child_id ON contact_logs(child_id);
CREATE INDEX IF NOT EXISTS idx_contact_logs_date ON contact_logs(date);
CREATE INDEX IF NOT EXISTS idx_contact_logs_status ON contact_logs(status);

-- RLS
ALTER TABLE contact_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "contact_logs_all" ON contact_logs FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Push subscriptions table for Web Push notifications
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT,
  auth TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "push_subscriptions_all" ON push_subscriptions FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
