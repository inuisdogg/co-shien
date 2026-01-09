-- ============================================
-- 不足しているテーブルを作成
-- leadsテーブルとmanagement_targetsテーブル
-- ============================================

-- leadsテーブル（初期スキーマに定義されているが、開発環境に存在しない場合に作成）
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  child_name TEXT,
  status TEXT NOT NULL CHECK (status IN ('new-inquiry', 'visit-scheduled', 'considering', 'waiting-benefit', 'contract-progress', 'contracted', 'lost')),
  phone TEXT,
  email TEXT,
  address TEXT,
  expected_start_date DATE,
  preferred_days TEXT[] DEFAULT ARRAY[]::TEXT[],
  pickup_option TEXT CHECK (pickup_option IN ('required', 'preferred', 'not-needed')),
  inquiry_source TEXT CHECK (inquiry_source IN ('devnavi', 'homepage', 'support-office', 'other')),
  inquiry_source_detail TEXT,
  child_ids TEXT[] DEFAULT ARRAY[]::TEXT[],
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_leads_facility_id ON leads(facility_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);

-- ============================================
-- management_targetsテーブル作成
-- 経営目標データを保存
-- ============================================

CREATE TABLE IF NOT EXISTS management_targets (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  staff_salaries JSONB DEFAULT '[]'::JSONB,
  fixed_cost_items JSONB DEFAULT '[]'::JSONB,
  variable_cost_items JSONB DEFAULT '[]'::JSONB,
  total_fixed_cost NUMERIC(12, 2) DEFAULT 0,
  total_variable_cost NUMERIC(12, 2) DEFAULT 0,
  target_revenue NUMERIC(12, 2) DEFAULT 0,
  target_occupancy_rate NUMERIC(5, 2) DEFAULT 0,
  daily_price_per_child NUMERIC(10, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(facility_id, year, month)
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_management_targets_facility_id ON management_targets(facility_id);
CREATE INDEX IF NOT EXISTS idx_management_targets_year_month ON management_targets(year, month);

