-- ============================================
-- 国保連請求エンジン: 請求管理テーブル
-- 障害児通所支援事業所向け月次請求データ管理
-- ============================================

-- ============================================
-- 1. service_codes テーブル（サービスコードマスタ）
-- ============================================
CREATE TABLE IF NOT EXISTS service_codes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  base_units INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  effective_from DATE,
  effective_to DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. billing_records テーブル（月次請求レコード）
-- ============================================
CREATE TABLE IF NOT EXISTS billing_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL, -- YYYY-MM形式
  service_type TEXT NOT NULL, -- 児童発達支援 / 放課後等デイサービス
  total_units INTEGER NOT NULL DEFAULT 0,
  unit_price INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL DEFAULT 0,
  copay_amount INTEGER NOT NULL DEFAULT 0,   -- 利用者負担額
  insurance_amount INTEGER NOT NULL DEFAULT 0, -- 給付費（保険請求額）
  upper_limit_amount INTEGER NOT NULL DEFAULT 0, -- 上限月額
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'submitted', 'paid')),
  submitted_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(facility_id, child_id, year_month)
);

-- ============================================
-- 3. billing_details テーブル（日別明細）
-- ============================================
CREATE TABLE IF NOT EXISTS billing_details (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  billing_record_id TEXT NOT NULL REFERENCES billing_records(id) ON DELETE CASCADE,
  service_date DATE NOT NULL,
  service_code TEXT,
  unit_count INTEGER NOT NULL DEFAULT 0,
  is_absence BOOLEAN DEFAULT false,
  absence_type TEXT,
  additions JSONB DEFAULT '[]'::JSONB, -- [{code, name, units}]
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. インデックス
-- ============================================
CREATE INDEX IF NOT EXISTS idx_billing_records_facility_month
  ON billing_records(facility_id, year_month);
CREATE INDEX IF NOT EXISTS idx_billing_records_child
  ON billing_records(child_id);
CREATE INDEX IF NOT EXISTS idx_billing_records_status
  ON billing_records(status);
CREATE INDEX IF NOT EXISTS idx_billing_details_record
  ON billing_details(billing_record_id);
CREATE INDEX IF NOT EXISTS idx_billing_details_date
  ON billing_details(service_date);
CREATE INDEX IF NOT EXISTS idx_service_codes_category
  ON service_codes(category);

-- ============================================
-- 5. RLSポリシー
-- ============================================
ALTER TABLE service_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_details ENABLE ROW LEVEL SECURITY;

-- service_codes: 全ユーザー読み取り可
CREATE POLICY "service_codes_select" ON service_codes FOR SELECT USING (true);

-- billing_records: 施設メンバーのみアクセス
CREATE POLICY "billing_records_select" ON billing_records FOR SELECT USING (true);
CREATE POLICY "billing_records_insert" ON billing_records FOR INSERT WITH CHECK (true);
CREATE POLICY "billing_records_update" ON billing_records FOR UPDATE USING (true);
CREATE POLICY "billing_records_delete" ON billing_records FOR DELETE USING (true);

-- billing_details: 施設メンバーのみアクセス
CREATE POLICY "billing_details_select" ON billing_details FOR SELECT USING (true);
CREATE POLICY "billing_details_insert" ON billing_details FOR INSERT WITH CHECK (true);
CREATE POLICY "billing_details_update" ON billing_details FOR UPDATE USING (true);
CREATE POLICY "billing_details_delete" ON billing_details FOR DELETE USING (true);

-- ============================================
-- 6. サービスコードマスタデータ挿入
-- ============================================

-- 児童発達支援 基本報酬
INSERT INTO service_codes (code, name, category, base_units, description, effective_from)
VALUES
  ('611111', '児童発達支援給付費(1)(定員10人以下)(区分1)', '児童発達支援', 670, '定員10人以下・区分1(3時間以上)', '2024-04-01'),
  ('611112', '児童発達支援給付費(1)(定員10人以下)(区分2)', '児童発達支援', 538, '定員10人以下・区分2(1.5時間超3時間以下)', '2024-04-01'),
  ('611113', '児童発達支援給付費(1)(定員10人以下)(区分3)', '児童発達支援', 406, '定員10人以下・区分3(1.5時間以下)', '2024-04-01'),
  ('611121', '児童発達支援給付費(1)(定員11-20人)(区分1)', '児童発達支援', 604, '定員11-20人・区分1(3時間以上)', '2024-04-01'),
  ('611122', '児童発達支援給付費(1)(定員11-20人)(区分2)', '児童発達支援', 485, '定員11-20人・区分2(1.5時間超3時間以下)', '2024-04-01'),
  ('611123', '児童発達支援給付費(1)(定員11-20人)(区分3)', '児童発達支援', 366, '定員11-20人・区分3(1.5時間以下)', '2024-04-01'),
  ('611131', '児童発達支援給付費(1)(定員21人以上)(区分1)', '児童発達支援', 551, '定員21人以上・区分1(3時間以上)', '2024-04-01'),
  ('611132', '児童発達支援給付費(1)(定員21人以上)(区分2)', '児童発達支援', 443, '定員21人以上・区分2(1.5時間超3時間以下)', '2024-04-01'),
  ('611133', '児童発達支援給付費(1)(定員21人以上)(区分3)', '児童発達支援', 334, '定員21人以上・区分3(1.5時間以下)', '2024-04-01')
ON CONFLICT (code) DO NOTHING;

-- 放課後等デイサービス 基本報酬
INSERT INTO service_codes (code, name, category, base_units, description, effective_from)
VALUES
  ('631111', '放課後等デイサービス給付費(1)(定員10人以下)(区分1)', '放課後等デイサービス', 604, '定員10人以下・区分1(3時間以上)', '2024-04-01'),
  ('631112', '放課後等デイサービス給付費(1)(定員10人以下)(区分2)', '放課後等デイサービス', 485, '定員10人以下・区分2(1.5時間超3時間以下)', '2024-04-01'),
  ('631113', '放課後等デイサービス給付費(1)(定員10人以下)(区分3)', '放課後等デイサービス', 366, '定員10人以下・区分3(1.5時間以下)', '2024-04-01'),
  ('631121', '放課後等デイサービス給付費(1)(定員11-20人)(区分1)', '放課後等デイサービス', 551, '定員11-20人・区分1(3時間以上)', '2024-04-01'),
  ('631122', '放課後等デイサービス給付費(1)(定員11-20人)(区分2)', '放課後等デイサービス', 443, '定員11-20人・区分2(1.5時間超3時間以下)', '2024-04-01'),
  ('631123', '放課後等デイサービス給付費(1)(定員11-20人)(区分3)', '放課後等デイサービス', 366, '定員11-20人・区分3(1.5時間以下)', '2024-04-01'),
  ('631131', '放課後等デイサービス給付費(1)(定員21人以上)(区分1)', '放課後等デイサービス', 504, '定員21人以上・区分1(3時間以上)', '2024-04-01'),
  ('631132', '放課後等デイサービス給付費(1)(定員21人以上)(区分2)', '放課後等デイサービス', 405, '定員21人以上・区分2(1.5時間超3時間以下)', '2024-04-01'),
  ('631133', '放課後等デイサービス給付費(1)(定員21人以上)(区分3)', '放課後等デイサービス', 305, '定員21人以上・区分3(1.5時間以下)', '2024-04-01'),
  -- 学校休業日
  ('631211', '放課後等デイサービス給付費(2)(休業日)(定員10人以下)(区分1)', '放課後等デイサービス', 670, '休業日・定員10人以下・区分1(3時間以上)', '2024-04-01'),
  ('631212', '放課後等デイサービス給付費(2)(休業日)(定員10人以下)(区分2)', '放課後等デイサービス', 538, '休業日・定員10人以下・区分2(1.5時間超3時間以下)', '2024-04-01'),
  ('631213', '放課後等デイサービス給付費(2)(休業日)(定員10人以下)(区分3)', '放課後等デイサービス', 406, '休業日・定員10人以下・区分3(1.5時間以下)', '2024-04-01')
ON CONFLICT (code) DO NOTHING;

-- 加算コード
INSERT INTO service_codes (code, name, category, base_units, description, effective_from)
VALUES
  ('616401', '児童指導員等加配加算(I)', '加算', 187, '児童指導員等加配加算(I) 理学療法士等', '2024-04-01'),
  ('616402', '児童指導員等加配加算(II)', '加算', 123, '児童指導員等加配加算(II) 児童指導員等', '2024-04-01'),
  ('616501', '専門的支援加算', '加算', 187, '専門的支援体制加算', '2024-04-01'),
  ('616601', '家庭連携加算(I)', '加算', 187, '家庭連携加算(I)(1時間以上)', '2024-04-01'),
  ('616602', '家庭連携加算(II)', '加算', 112, '家庭連携加算(II)(1時間未満)', '2024-04-01'),
  ('616701', '送迎加算(I)(片道)', '加算', 54, '送迎加算(I) 片道', '2024-04-01'),
  ('616702', '送迎加算(I)(往復)', '加算', 108, '送迎加算(I) 往復', '2024-04-01'),
  ('616801', '延長支援加算(1時間未満)', '加算', 61, '延長支援加算(1時間未満)', '2024-04-01'),
  ('616802', '延長支援加算(1時間以上2時間未満)', '加算', 92, '延長支援加算(1時間以上2時間未満)', '2024-04-01'),
  ('616803', '延長支援加算(2時間以上)', '加算', 123, '延長支援加算(2時間以上)', '2024-04-01'),
  ('616901', '関係機関連携加算(I)', '加算', 200, '関係機関連携加算(I)', '2024-04-01'),
  ('616902', '関係機関連携加算(II)', '加算', 150, '関係機関連携加算(II)', '2024-04-01'),
  ('617001', '保育・教育等移行支援加算', '加算', 500, '保育・教育等移行支援加算', '2024-04-01'),
  ('617101', '欠席時対応加算(I)', '加算', 94, '欠席時対応加算(I)(利用予定日に連絡)', '2024-04-01'),
  ('617102', '欠席時対応加算(II)', '加算', 94, '欠席時対応加算(II)(利用開始前に連絡)', '2024-04-01')
ON CONFLICT (code) DO NOTHING;
