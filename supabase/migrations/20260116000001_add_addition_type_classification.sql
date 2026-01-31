-- ============================================
-- 加算タイプ分類の追加
-- 施設事前届出型 vs 月次選択型 vs 日次実績型
-- ============================================

-- additions テーブルに加算タイプを追加
ALTER TABLE additions ADD COLUMN IF NOT EXISTS addition_type TEXT DEFAULT 'monthly';

COMMENT ON COLUMN additions.addition_type IS '加算タイプ: facility_preset(施設事前届出型), monthly(月次選択型), daily(日次実績型)';

-- ============================================
-- 既存データの分類を更新
-- ============================================

-- 施設事前届出型（体制加算）: 行政に事前届出して期間中は自動適用
UPDATE additions SET addition_type = 'facility_preset' WHERE code IN (
  -- 人員配置体制加算
  'staff_allocation_1_fulltime',
  'staff_allocation_1_convert',
  'staff_allocation_2_fulltime',
  'staff_allocation_2_convert',
  'staff_allocation_3',
  -- 専門的支援
  'specialist_support',
  'care_needs_basic',
  -- 処遇改善加算
  'treatment_improvement_1',
  'treatment_improvement_2',
  'treatment_improvement_3',
  'treatment_improvement_4',
  -- 訪問支援特別加算
  'visit_specialist_1',
  'visit_specialist_2',
  'multi_discipline',
  -- 居宅訪問型
  'home_visit_specialist'
);

-- 日次実績型: 毎日の実績に基づき算定
UPDATE additions SET addition_type = 'daily' WHERE code IN (
  -- 送迎加算
  'transport',
  'transport_same_site',
  'transport_independence',
  -- 入浴支援
  'bathing_support',
  -- 食事提供
  'meal_provision',
  -- 延長支援
  'extension_1h',
  'extension_2h',
  'extension_over2h'
);

-- 月次選択型（デフォルト）: 月ごとに選択
-- family_support_*, agency_cooperation_*, individual_support_*, behavior_support_* 等
-- デフォルトで 'monthly' が設定されているため、明示的な更新は不要

-- ============================================
-- インデックス追加（検索性能向上）
-- ============================================
CREATE INDEX IF NOT EXISTS idx_additions_type ON additions(addition_type);

-- ============================================
-- ビュー: 加算タイプ別一覧
-- ============================================
CREATE OR REPLACE VIEW v_additions_by_type AS
SELECT
  a.code,
  a.name,
  a.category_code,
  ac.name AS category_name,
  a.addition_type,
  a.units,
  a.is_percentage,
  a.percentage_rate,
  a.applicable_services,
  a.requirements,
  a.max_times_per_month,
  a.is_exclusive,
  a.display_order
FROM additions a
LEFT JOIN addition_categories ac ON ac.code = a.category_code
WHERE a.is_active = TRUE
ORDER BY a.addition_type, a.display_order;

COMMENT ON VIEW v_additions_by_type IS '加算タイプ別一覧（facility_preset/monthly/daily）';
