-- Migration: Platform Admin Enhancement
-- プラットフォーム管理者向けの拡張機能
-- 法人管理・施設横断分析・ベンチマーク機能のためのスキーマ変更

-- ============================================================
-- 1a. Enhance companies table
-- ============================================================
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS company_type TEXT DEFAULT 'independent'
  CHECK (company_type IN ('corporation', 'npo', 'individual', 'independent')),
ADD COLUMN IF NOT EXISTS franchise_brand TEXT,
ADD COLUMN IF NOT EXISTS contract_tier TEXT DEFAULT 'standard'
  CHECK (contract_tier IN ('basic', 'standard', 'premium')),
ADD COLUMN IF NOT EXISTS monthly_fee NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS contract_status TEXT DEFAULT 'active'
  CHECK (contract_status IN ('negotiating', 'active', 'suspended', 'terminated')),
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT;

COMMENT ON COLUMN companies.company_type IS '法人種別: corporation=法人, npo=NPO, individual=個人事業主, independent=独立';
COMMENT ON COLUMN companies.franchise_brand IS 'フランチャイズブランド名（該当する場合）';
COMMENT ON COLUMN companies.contract_tier IS '契約プラン: basic, standard, premium';
COMMENT ON COLUMN companies.monthly_fee IS '月額利用料';
COMMENT ON COLUMN companies.contract_status IS '契約状態: negotiating=交渉中, active=有効, suspended=停止, terminated=解約';
COMMENT ON COLUMN companies.notes IS '管理用メモ';
COMMENT ON COLUMN companies.address IS '法人住所';
COMMENT ON COLUMN companies.phone IS '法人電話番号';

-- ============================================================
-- 1b. Enhance facilities table
-- ============================================================
ALTER TABLE facilities
ADD COLUMN IF NOT EXISTS platform_notes TEXT,
ADD COLUMN IF NOT EXISTS capacity_total INT,
ADD COLUMN IF NOT EXISTS service_category TEXT;

COMMENT ON COLUMN facilities.platform_notes IS 'プラットフォーム管理者用メモ';
COMMENT ON COLUMN facilities.capacity_total IS '定員合計';
COMMENT ON COLUMN facilities.service_category IS 'サービス区分';

-- ============================================================
-- 1c. Create platform_benchmarks table
-- ============================================================
CREATE TABLE IF NOT EXISTS platform_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year_month TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  p25 NUMERIC(12,2),
  p50 NUMERIC(12,2),
  p75 NUMERIC(12,2),
  p90 NUMERIC(12,2),
  mean_value NUMERIC(12,2),
  std_dev NUMERIC(12,2),
  sample_size INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(year_month, metric_name)
);

CREATE INDEX IF NOT EXISTS idx_platform_benchmarks_month ON platform_benchmarks(year_month);

COMMENT ON TABLE platform_benchmarks IS 'プラットフォーム全体のベンチマーク統計データ（月次集計）';
COMMENT ON COLUMN platform_benchmarks.year_month IS '対象年月 (YYYY-MM形式)';
COMMENT ON COLUMN platform_benchmarks.metric_name IS '指標名 (例: revenue_per_child, utilization_rate)';
COMMENT ON COLUMN platform_benchmarks.p25 IS '25パーセンタイル';
COMMENT ON COLUMN platform_benchmarks.p50 IS '中央値（50パーセンタイル）';
COMMENT ON COLUMN platform_benchmarks.p75 IS '75パーセンタイル';
COMMENT ON COLUMN platform_benchmarks.p90 IS '90パーセンタイル';
COMMENT ON COLUMN platform_benchmarks.mean_value IS '平均値';
COMMENT ON COLUMN platform_benchmarks.std_dev IS '標準偏差';
COMMENT ON COLUMN platform_benchmarks.sample_size IS 'サンプルサイズ（対象施設数）';

-- ============================================================
-- 1d. RLS Policies
-- ============================================================

-- Enable RLS on platform_benchmarks
ALTER TABLE platform_benchmarks ENABLE ROW LEVEL SECURITY;

-- Owner can read benchmarks
CREATE POLICY "owner_read_benchmarks" ON platform_benchmarks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid()::text AND users.role = 'owner')
  );

-- Owner can insert benchmarks
CREATE POLICY "owner_write_benchmarks" ON platform_benchmarks
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid()::text AND users.role = 'owner')
  );

-- Owner can update benchmarks
CREATE POLICY "owner_update_benchmarks" ON platform_benchmarks
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid()::text AND users.role = 'owner')
  );

-- ============================================================
-- Cross-facility read policies for owner role
-- Wrapped in DO blocks to avoid duplicate_object errors
-- ============================================================

-- Allow owners to read all billing_records
DO $$ BEGIN
  CREATE POLICY "owner_read_all_billing" ON billing_records
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid()::text AND users.role = 'owner')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Allow owners to read all staff
DO $$ BEGIN
  CREATE POLICY "owner_read_all_staff" ON staff
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid()::text AND users.role = 'owner')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Allow owners to read all children
DO $$ BEGIN
  CREATE POLICY "owner_read_all_children" ON children
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid()::text AND users.role = 'owner')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Allow owners to read all usage_records
DO $$ BEGIN
  CREATE POLICY "owner_read_all_usage_records" ON usage_records
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid()::text AND users.role = 'owner')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Allow owners to read all cashflow_entries
DO $$ BEGIN
  CREATE POLICY "owner_read_all_cashflow_entries" ON cashflow_entries
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid()::text AND users.role = 'owner')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Allow owners to read all facility_addition_settings
DO $$ BEGIN
  CREATE POLICY "owner_read_all_facility_addition_settings" ON facility_addition_settings
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid()::text AND users.role = 'owner')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Allow owners to read all employment_records
DO $$ BEGIN
  CREATE POLICY "owner_read_all_employment_records" ON employment_records
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid()::text AND users.role = 'owner')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Allow owners to read all facility_reviews
DO $$ BEGIN
  CREATE POLICY "owner_read_all_facility_reviews" ON facility_reviews
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid()::text AND users.role = 'owner')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Allow owners to read all additions
DO $$ BEGIN
  CREATE POLICY "owner_read_all_additions" ON additions
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid()::text AND users.role = 'owner')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
