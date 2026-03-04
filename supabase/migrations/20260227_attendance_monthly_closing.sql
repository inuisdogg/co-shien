-- 月次勤怠締めステータス管理テーブル
CREATE TABLE IF NOT EXISTS attendance_monthly_closings (
  id TEXT DEFAULT gen_random_uuid()::TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL REFERENCES facilities(id),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  closed_at TIMESTAMPTZ,
  closed_by TEXT REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(facility_id, year, month)
);

ALTER TABLE attendance_monthly_closings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "attendance_closings_facility_access" ON attendance_monthly_closings;
CREATE POLICY "attendance_closings_facility_access" ON attendance_monthly_closings
  FOR ALL USING (true);
