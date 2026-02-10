-- ============================================
-- 加算シミュレーション用テーブル
-- 児童別月間加算計画
-- ============================================

-- child_addition_plans テーブル
CREATE TABLE IF NOT EXISTS child_addition_plans (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),

  -- 加算計画
  addition_code TEXT NOT NULL,  -- additions.codeを参照（外部キー制約はしない、マスタ変更に柔軟に対応）
  planned_count INTEGER NOT NULL DEFAULT 0,  -- 予定回数

  -- メモ
  notes TEXT,

  -- メタ
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(child_id, facility_id, year, month, addition_code)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_child_addition_plans_facility_month
  ON child_addition_plans(facility_id, year, month);
CREATE INDEX IF NOT EXISTS idx_child_addition_plans_child
  ON child_addition_plans(child_id);
CREATE INDEX IF NOT EXISTS idx_child_addition_plans_code
  ON child_addition_plans(addition_code);

-- RLS設定
ALTER TABLE child_addition_plans ENABLE ROW LEVEL SECURITY;

-- 全操作許可（施設スタッフ向け）
CREATE POLICY "child_addition_plans_all" ON child_addition_plans FOR ALL USING (true);

-- コメント
COMMENT ON TABLE child_addition_plans IS '児童別月間加算計画（シミュレーション用）';
COMMENT ON COLUMN child_addition_plans.planned_count IS '予定回数（専門支援4回、送迎20回など）';
