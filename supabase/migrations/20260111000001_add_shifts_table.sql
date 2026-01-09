-- ============================================
-- shiftsテーブル作成
-- スタッフのシフトデータを保存
-- ============================================

CREATE TABLE IF NOT EXISTS shifts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  has_shift BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(facility_id, staff_id, date)
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_shifts_facility_id ON shifts(facility_id);
CREATE INDEX IF NOT EXISTS idx_shifts_staff_id ON shifts(staff_id);
CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date);
CREATE INDEX IF NOT EXISTS idx_shifts_facility_date ON shifts(facility_id, date);

