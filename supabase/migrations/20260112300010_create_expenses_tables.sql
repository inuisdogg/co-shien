-- 経費管理・経営分析機能用テーブル

-- 1. 経費カテゴリマスタ
CREATE TABLE IF NOT EXISTS expense_categories (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT REFERENCES facilities(id) ON DELETE CASCADE, -- NULL=システム共通
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES expense_categories(id) ON DELETE SET NULL,
  keywords TEXT[] DEFAULT '{}',
  icon TEXT,
  color TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 経費トランザクション
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  staff_id TEXT NOT NULL,
  submitted_by_user_id TEXT NOT NULL,

  -- 基本情報
  title TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  expense_date DATE NOT NULL,

  -- カテゴリ
  category TEXT NOT NULL,
  subcategory TEXT,

  -- 詳細
  description TEXT,
  receipt_url TEXT,
  receipt_file_name TEXT,
  receipt_file_size INTEGER,

  -- 承認フロー
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- メタ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 月次財務サマリー
CREATE TABLE IF NOT EXISTS monthly_financials (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),

  -- 収入
  revenue_service NUMERIC(12, 2) DEFAULT 0,
  revenue_other NUMERIC(12, 2) DEFAULT 0,

  -- 支出（カテゴリ別）
  expense_personnel NUMERIC(12, 2) DEFAULT 0,
  expense_fixed NUMERIC(12, 2) DEFAULT 0,
  expense_variable NUMERIC(12, 2) DEFAULT 0,
  expense_other NUMERIC(12, 2) DEFAULT 0,

  -- 計算値
  gross_profit NUMERIC(12, 2) DEFAULT 0,
  operating_profit NUMERIC(12, 2) DEFAULT 0,
  net_cash_flow NUMERIC(12, 2) DEFAULT 0,

  -- 予算
  budget_revenue NUMERIC(12, 2),
  budget_expense NUMERIC(12, 2),

  -- 確定フラグ
  is_finalized BOOLEAN DEFAULT false,
  finalized_at TIMESTAMPTZ,
  finalized_by TEXT,

  -- メモ
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(facility_id, year, month)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_expense_categories_facility ON expense_categories(facility_id);
CREATE INDEX IF NOT EXISTS idx_expense_categories_parent ON expense_categories(parent_id);

CREATE INDEX IF NOT EXISTS idx_expenses_facility ON expenses(facility_id);
CREATE INDEX IF NOT EXISTS idx_expenses_staff ON expenses(staff_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_facility_date ON expenses(facility_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_facility_status ON expenses(facility_id, status);

CREATE INDEX IF NOT EXISTS idx_monthly_financials_facility ON monthly_financials(facility_id);
CREATE INDEX IF NOT EXISTS idx_monthly_financials_period ON monthly_financials(year, month);
CREATE INDEX IF NOT EXISTS idx_monthly_financials_facility_period ON monthly_financials(facility_id, year, month);

-- RLS有効化
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_financials ENABLE ROW LEVEL SECURITY;

-- RLSポリシー（すべてのユーザーに許可 - 本番環境ではより厳密に設定）
CREATE POLICY "expense_categories_select" ON expense_categories FOR SELECT USING (true);
CREATE POLICY "expense_categories_insert" ON expense_categories FOR INSERT WITH CHECK (true);
CREATE POLICY "expense_categories_update" ON expense_categories FOR UPDATE USING (true);
CREATE POLICY "expense_categories_delete" ON expense_categories FOR DELETE USING (true);

CREATE POLICY "expenses_select" ON expenses FOR SELECT USING (true);
CREATE POLICY "expenses_insert" ON expenses FOR INSERT WITH CHECK (true);
CREATE POLICY "expenses_update" ON expenses FOR UPDATE USING (true);
CREATE POLICY "expenses_delete" ON expenses FOR DELETE USING (true);

CREATE POLICY "monthly_financials_select" ON monthly_financials FOR SELECT USING (true);
CREATE POLICY "monthly_financials_insert" ON monthly_financials FOR INSERT WITH CHECK (true);
CREATE POLICY "monthly_financials_update" ON monthly_financials FOR UPDATE USING (true);
CREATE POLICY "monthly_financials_delete" ON monthly_financials FOR DELETE USING (true);

-- デフォルト経費カテゴリの挿入
INSERT INTO expense_categories (id, facility_id, name, keywords, icon, color, display_order) VALUES
  ('cat-transport', NULL, '交通費', ARRAY['交通', '電車', 'バス', 'タクシー', 'ガソリン', '駐車', '高速'], 'Car', 'blue', 1),
  ('cat-supplies', NULL, '消耗品費', ARRAY['文房具', 'コピー', '用紙', '教材', '消毒', '衛生', 'マスク'], 'Package', 'green', 2),
  ('cat-food', NULL, '食費', ARRAY['食事', '弁当', 'おやつ', '飲料', '給食'], 'Utensils', 'orange', 3),
  ('cat-telecom', NULL, '通信費', ARRAY['電話', '通信', 'Wi-Fi', 'インターネット', '携帯'], 'Phone', 'purple', 4),
  ('cat-utilities', NULL, '水道光熱費', ARRAY['電気', 'ガス', '水道', '光熱'], 'Zap', 'yellow', 5),
  ('cat-repair', NULL, '修繕費', ARRAY['修理', '修繕', 'メンテナンス', '補修'], 'Wrench', 'red', 6),
  ('cat-training', NULL, '研修費', ARRAY['研修', '資格', 'セミナー', '講習', '受講'], 'GraduationCap', 'indigo', 7),
  ('cat-other', NULL, 'その他', ARRAY[]::TEXT[], 'MoreHorizontal', 'gray', 99)
ON CONFLICT (id) DO NOTHING;

-- コメント
COMMENT ON TABLE expense_categories IS '経費カテゴリマスタ';
COMMENT ON TABLE expenses IS '経費トランザクション';
COMMENT ON TABLE monthly_financials IS '月次財務サマリー';

COMMENT ON COLUMN expense_categories.facility_id IS 'NULL=システム共通カテゴリ';
COMMENT ON COLUMN expense_categories.keywords IS '自動カテゴリ分類用キーワード配列';
COMMENT ON COLUMN expenses.status IS '申請ステータス: pending(申請中), approved(承認), rejected(却下)';
COMMENT ON COLUMN monthly_financials.is_finalized IS '月次締め処理済みフラグ';
