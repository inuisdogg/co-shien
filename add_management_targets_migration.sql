-- 経営目標設定テーブルの作成
-- 月ごとの経営目標（固定費、変動費、目標値、単価）を管理

CREATE TABLE IF NOT EXISTS management_targets (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  -- 詳細なコスト設定（JSON形式）
  staff_salaries JSONB DEFAULT '[]'::jsonb, -- 人件費（スタッフごと）
  fixed_cost_items JSONB DEFAULT '[]'::jsonb, -- 固定費項目（家賃、光熱費など）
  variable_cost_items JSONB DEFAULT '[]'::jsonb, -- 変動費項目
  -- 計算された合計
  total_fixed_cost INTEGER NOT NULL DEFAULT 0, -- 固定費合計
  total_variable_cost INTEGER NOT NULL DEFAULT 0, -- 変動費合計
  -- 目標設定
  target_revenue INTEGER NOT NULL DEFAULT 0,
  target_occupancy_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
  -- 単価設定
  daily_price_per_child INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(facility_id, year, month)
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_management_targets_facility_id ON management_targets(facility_id);
CREATE INDEX IF NOT EXISTS idx_management_targets_year_month ON management_targets(year, month);

-- RLS (Row Level Security) の設定
-- 注意: 本番環境では適切なRLSポリシーを設定してください
-- 現在は開発用にRLSを無効化しています
-- ALTER TABLE management_targets ENABLE ROW LEVEL SECURITY;

-- ポリシーの設定例（全ユーザーが読み書き可能な場合）
-- CREATE POLICY "Allow all operations on management_targets" ON management_targets
--   FOR ALL
--   USING (true)
--   WITH CHECK (true);

-- または、facility_idで制限する場合（auth.usersを使用する場合）
-- CREATE POLICY "Users can view management targets for their facility"
--   ON management_targets FOR SELECT
--   USING (
--     facility_id IN (
--       SELECT facility_id FROM auth.users WHERE id = auth.uid()
--     )
--   );

-- updated_at を自動更新するトリガー
CREATE OR REPLACE FUNCTION update_management_targets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_management_targets_updated_at
  BEFORE UPDATE ON management_targets
  FOR EACH ROW
  EXECUTE FUNCTION update_management_targets_updated_at();

