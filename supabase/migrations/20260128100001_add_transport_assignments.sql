-- ============================================
-- 送迎担当者割り当て・完了チェック機能
-- ============================================

-- ============================================
-- 1. 日別送迎担当者割り当て
-- ============================================
CREATE TABLE IF NOT EXISTS daily_transport_assignments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  -- 運転手（必須）
  driver_staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  -- 添乗員（必須）
  attendant_staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  -- メモ
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(facility_id, date)
);

CREATE INDEX IF NOT EXISTS idx_transport_assignments_facility ON daily_transport_assignments(facility_id);
CREATE INDEX IF NOT EXISTS idx_transport_assignments_date ON daily_transport_assignments(date);
CREATE INDEX IF NOT EXISTS idx_transport_assignments_driver ON daily_transport_assignments(driver_staff_id);
CREATE INDEX IF NOT EXISTS idx_transport_assignments_attendant ON daily_transport_assignments(attendant_staff_id);

COMMENT ON TABLE daily_transport_assignments IS '日別の送迎担当者割り当て';
COMMENT ON COLUMN daily_transport_assignments.driver_staff_id IS '運転手のスタッフID';
COMMENT ON COLUMN daily_transport_assignments.attendant_staff_id IS '添乗員のスタッフID';

-- ============================================
-- 2. 送迎完了チェック記録
-- ============================================
CREATE TABLE IF NOT EXISTS transport_completion_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  schedule_id TEXT NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  -- お迎え完了
  pickup_completed BOOLEAN DEFAULT FALSE,
  pickup_completed_at TIMESTAMPTZ,
  pickup_completed_by TEXT REFERENCES staff(id) ON DELETE SET NULL,
  pickup_notes TEXT,
  -- お送り完了
  dropoff_completed BOOLEAN DEFAULT FALSE,
  dropoff_completed_at TIMESTAMPTZ,
  dropoff_completed_by TEXT REFERENCES staff(id) ON DELETE SET NULL,
  dropoff_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(facility_id, date, schedule_id)
);

CREATE INDEX IF NOT EXISTS idx_transport_completion_facility ON transport_completion_records(facility_id);
CREATE INDEX IF NOT EXISTS idx_transport_completion_date ON transport_completion_records(date);
CREATE INDEX IF NOT EXISTS idx_transport_completion_schedule ON transport_completion_records(schedule_id);
CREATE INDEX IF NOT EXISTS idx_transport_completion_child ON transport_completion_records(child_id);

COMMENT ON TABLE transport_completion_records IS '送迎完了チェック記録';
COMMENT ON COLUMN transport_completion_records.pickup_completed IS 'お迎え完了フラグ';
COMMENT ON COLUMN transport_completion_records.dropoff_completed IS 'お送り完了フラグ';

-- ============================================
-- 3. RLS設定
-- ============================================
ALTER TABLE daily_transport_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_completion_records ENABLE ROW LEVEL SECURITY;

-- daily_transport_assignments RLS
DROP POLICY IF EXISTS "transport_assignments_select" ON daily_transport_assignments;
CREATE POLICY "transport_assignments_select" ON daily_transport_assignments FOR SELECT USING (true);

DROP POLICY IF EXISTS "transport_assignments_insert" ON daily_transport_assignments;
CREATE POLICY "transport_assignments_insert" ON daily_transport_assignments FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "transport_assignments_update" ON daily_transport_assignments;
CREATE POLICY "transport_assignments_update" ON daily_transport_assignments FOR UPDATE USING (true);

DROP POLICY IF EXISTS "transport_assignments_delete" ON daily_transport_assignments;
CREATE POLICY "transport_assignments_delete" ON daily_transport_assignments FOR DELETE USING (true);

-- transport_completion_records RLS
DROP POLICY IF EXISTS "transport_completion_select" ON transport_completion_records;
CREATE POLICY "transport_completion_select" ON transport_completion_records FOR SELECT USING (true);

DROP POLICY IF EXISTS "transport_completion_insert" ON transport_completion_records;
CREATE POLICY "transport_completion_insert" ON transport_completion_records FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "transport_completion_update" ON transport_completion_records;
CREATE POLICY "transport_completion_update" ON transport_completion_records FOR UPDATE USING (true);

DROP POLICY IF EXISTS "transport_completion_delete" ON transport_completion_records;
CREATE POLICY "transport_completion_delete" ON transport_completion_records FOR DELETE USING (true);
