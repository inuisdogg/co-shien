-- 送迎体制管理の拡張: 迎え/送り別の担当者割り当て

-- テーブルがリモートに存在しない場合は作成（元の定義ベース）
CREATE TABLE IF NOT EXISTS daily_transport_assignments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL,
  date DATE NOT NULL,
  driver_staff_id TEXT,
  attendant_staff_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(facility_id, date)
);

ALTER TABLE daily_transport_assignments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "daily_transport_assignments_all" ON daily_transport_assignments FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_transport_assignments_facility ON daily_transport_assignments(facility_id);
CREATE INDEX IF NOT EXISTS idx_transport_assignments_date ON daily_transport_assignments(date);

-- transport_completion_records も同様
CREATE TABLE IF NOT EXISTS transport_completion_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL,
  date DATE NOT NULL,
  schedule_id TEXT,
  child_id TEXT,
  pickup_completed BOOLEAN DEFAULT FALSE,
  pickup_completed_at TIMESTAMPTZ,
  pickup_completed_by TEXT,
  pickup_notes TEXT,
  dropoff_completed BOOLEAN DEFAULT FALSE,
  dropoff_completed_at TIMESTAMPTZ,
  dropoff_completed_by TEXT,
  dropoff_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE transport_completion_records ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "transport_completion_records_all" ON transport_completion_records FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 迎え（pickup）担当
ALTER TABLE daily_transport_assignments ADD COLUMN IF NOT EXISTS pickup_driver_staff_id TEXT;
ALTER TABLE daily_transport_assignments ADD COLUMN IF NOT EXISTS pickup_attendant_staff_id TEXT;

-- 送り（dropoff）担当
ALTER TABLE daily_transport_assignments ADD COLUMN IF NOT EXISTS dropoff_driver_staff_id TEXT;
ALTER TABLE daily_transport_assignments ADD COLUMN IF NOT EXISTS dropoff_attendant_staff_id TEXT;

-- 車両情報
ALTER TABLE daily_transport_assignments ADD COLUMN IF NOT EXISTS vehicle_info TEXT;

-- 迎え/送り時間
ALTER TABLE daily_transport_assignments ADD COLUMN IF NOT EXISTS pickup_time TIME;
ALTER TABLE daily_transport_assignments ADD COLUMN IF NOT EXISTS dropoff_time TIME;
