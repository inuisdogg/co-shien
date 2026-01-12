-- 施設別児童設定テーブル
-- 施設固有の情報（利用パターン、送迎、担当職員等）を管理

CREATE TABLE IF NOT EXISTS facility_children_settings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,

  -- 利用パターン
  pattern_days JSONB,              -- [1, 3, 5] (月・水・金)
  pattern_time_slots JSONB,        -- {1: "PM", 3: "AMPM"}

  -- 送迎設定
  needs_pickup BOOLEAN DEFAULT false,
  needs_dropoff BOOLEAN DEFAULT false,
  pickup_location TEXT,
  dropoff_location TEXT,

  -- 契約情報
  contract_days INTEGER,           -- この施設での契約日数
  contract_start_date DATE,
  contract_end_date DATE,

  -- 担当職員
  assigned_staff_ids TEXT[],

  -- 加算設定（デフォルト）
  default_addon_items TEXT[],

  -- メタデータ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(facility_id, child_id)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_fcs_facility ON facility_children_settings(facility_id);
CREATE INDEX IF NOT EXISTS idx_fcs_child ON facility_children_settings(child_id);

-- RLS
ALTER TABLE facility_children_settings ENABLE ROW LEVEL SECURITY;

-- ポリシー
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'fcs_select' AND tablename = 'facility_children_settings') THEN
    CREATE POLICY fcs_select ON facility_children_settings FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'fcs_insert' AND tablename = 'facility_children_settings') THEN
    CREATE POLICY fcs_insert ON facility_children_settings FOR INSERT WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'fcs_update' AND tablename = 'facility_children_settings') THEN
    CREATE POLICY fcs_update ON facility_children_settings FOR UPDATE USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'fcs_delete' AND tablename = 'facility_children_settings') THEN
    CREATE POLICY fcs_delete ON facility_children_settings FOR DELETE USING (true);
  END IF;
END $$;
