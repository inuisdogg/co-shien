-- 変更届通知テーブル
-- 施設設定の変更を検出し、行政への届出期限を管理する

CREATE TABLE IF NOT EXISTS change_notifications (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL, -- 'business_hours', 'manager', 'service_manager', 'capacity', 'facility_name', 'address', 'equipment', 'subsidy'
  change_description TEXT,
  old_value JSONB DEFAULT '{}',
  new_value JSONB DEFAULT '{}',
  detected_at TIMESTAMPTZ DEFAULT now(),
  deadline TIMESTAMPTZ NOT NULL, -- detected_at + 10 days (or 15th of preceding month for subsidies)
  status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'submitted', 'completed'
  submitted_at TIMESTAMPTZ,
  related_documents JSONB DEFAULT '[]', -- generated document references
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_change_notifications_facility_id ON change_notifications(facility_id);
CREATE INDEX IF NOT EXISTS idx_change_notifications_status ON change_notifications(status);
CREATE INDEX IF NOT EXISTS idx_change_notifications_deadline ON change_notifications(deadline);

-- RLS
ALTER TABLE change_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "change_notifications_all_access" ON change_notifications
  FOR ALL USING (true) WITH CHECK (true);
