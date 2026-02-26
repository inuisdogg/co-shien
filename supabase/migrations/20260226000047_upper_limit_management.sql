-- 上限管理テーブル
CREATE TABLE IF NOT EXISTS upper_limit_management (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL,
  child_id TEXT NOT NULL,
  year_month TEXT NOT NULL, -- YYYY-MM
  -- 上限管理区分
  management_type TEXT NOT NULL DEFAULT 'none', -- none: 管理不要, self: 自事業所のみ, coordinator: 上限管理事業所, managed: 被管理事業所
  upper_limit_amount INTEGER NOT NULL DEFAULT 0, -- 負担上限月額
  -- 自事業所の情報
  self_total_units INTEGER DEFAULT 0, -- 自事業所の総単位数
  self_copay_amount INTEGER DEFAULT 0, -- 自事業所の利用者負担額
  self_usage_days INTEGER DEFAULT 0, -- 自事業所の利用日数
  -- 管理結果
  result_type TEXT, -- confirmed: 確定, adjusted: 調整済, pending: 未確定
  adjusted_copay_amount INTEGER, -- 調整後の自事業所負担額
  total_copay_all_facilities INTEGER, -- 全事業所合計の負担額
  -- メタデータ
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(facility_id, child_id, year_month)
);

ALTER TABLE upper_limit_management ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "upper_limit_all" ON upper_limit_management FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 上限管理の他事業所情報
CREATE TABLE IF NOT EXISTS upper_limit_other_facilities (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  upper_limit_id TEXT NOT NULL REFERENCES upper_limit_management(id) ON DELETE CASCADE,
  facility_number TEXT, -- 事業所番号
  facility_name TEXT NOT NULL,
  total_units INTEGER DEFAULT 0,
  copay_amount INTEGER DEFAULT 0,
  usage_days INTEGER DEFAULT 0,
  adjusted_copay_amount INTEGER,
  contact_phone TEXT,
  contact_fax TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE upper_limit_other_facilities ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "upper_limit_other_all" ON upper_limit_other_facilities FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
