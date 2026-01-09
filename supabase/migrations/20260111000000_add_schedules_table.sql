-- ============================================
-- schedulesテーブル作成
-- 利用調整・予約データを保存
-- ============================================

CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  child_name TEXT NOT NULL,
  date DATE NOT NULL,
  slot TEXT NOT NULL CHECK (slot IN ('AM', 'PM')),
  has_pickup BOOLEAN DEFAULT false,
  has_dropoff BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_schedules_facility_id ON schedules(facility_id);
CREATE INDEX IF NOT EXISTS idx_schedules_child_id ON schedules(child_id);
CREATE INDEX IF NOT EXISTS idx_schedules_date ON schedules(date);
CREATE INDEX IF NOT EXISTS idx_schedules_facility_date ON schedules(facility_id, date);

-- ============================================
-- usage_recordsテーブル作成
-- 利用実績データを保存
-- ============================================

CREATE TABLE IF NOT EXISTS usage_records (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  schedule_id TEXT NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  child_name TEXT NOT NULL,
  date DATE NOT NULL,
  service_status TEXT NOT NULL CHECK (service_status IN ('利用', '欠席(加算なし)', '加算のみ')),
  provision_form TEXT,
  planned_start_time TIME,
  planned_end_time TIME,
  planned_time_one_minute_interval BOOLEAN DEFAULT false,
  actual_start_time TIME,
  actual_end_time TIME,
  actual_time_one_minute_interval BOOLEAN DEFAULT false,
  calculated_time NUMERIC(5, 2) DEFAULT 0,
  calculated_time_method TEXT NOT NULL CHECK (calculated_time_method IN ('計画時間から算出', '開始終了時間から算出', '手動入力')),
  time_category TEXT,
  pickup TEXT NOT NULL CHECK (pickup IN ('あり', 'なし')),
  pickup_same_premises BOOLEAN DEFAULT false,
  dropoff TEXT NOT NULL CHECK (dropoff IN ('あり', 'なし')),
  dropoff_same_premises BOOLEAN DEFAULT false,
  room TEXT,
  instruction_form TEXT NOT NULL CHECK (instruction_form IN ('個別', '小集団', '集団')),
  billing_target TEXT NOT NULL CHECK (billing_target IN ('請求する', '請求しない')),
  self_pay_item TEXT,
  memo TEXT,
  record_sheet_remarks TEXT,
  addon_items JSONB DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_usage_records_facility_id ON usage_records(facility_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_schedule_id ON usage_records(schedule_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_child_id ON usage_records(child_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_date ON usage_records(date);

