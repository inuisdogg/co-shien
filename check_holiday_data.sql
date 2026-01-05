-- ============================================
-- 施設設定の休業日データを確認
-- ============================================
-- このクエリを実行して、実際のデータ構造を確認してください
-- ============================================

-- 1. 施設設定の全データを確認
SELECT 
  facility_id,
  facility_name,
  regular_holidays,
  custom_holidays,
  holiday_periods,
  include_holidays,
  -- データ型の確認
  pg_typeof(regular_holidays) as regular_holidays_type,
  pg_typeof(custom_holidays) as custom_holidays_type,
  pg_typeof(holiday_periods) as holiday_periods_type
FROM facility_settings
ORDER BY created_at DESC
LIMIT 5;

-- 2. holiday_periodsの詳細を確認（JSONBとして展開）
SELECT 
  facility_id,
  facility_name,
  holiday_periods,
  jsonb_array_length(COALESCE(holiday_periods, '[]'::jsonb)) as period_count,
  jsonb_pretty(holiday_periods) as holiday_periods_pretty
FROM facility_settings
WHERE holiday_periods IS NOT NULL 
  AND holiday_periods != '[]'::jsonb
ORDER BY created_at DESC
LIMIT 5;

-- 3. custom_holidaysの詳細を確認
SELECT 
  facility_id,
  facility_name,
  custom_holidays,
  array_length(custom_holidays, 1) as custom_holidays_count,
  custom_holidays[1] as first_custom_holiday
FROM facility_settings
WHERE custom_holidays IS NOT NULL 
  AND array_length(custom_holidays, 1) > 0
ORDER BY created_at DESC
LIMIT 5;

-- 4. カラムの存在確認
SELECT 
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'facility_settings'
  AND column_name IN ('regular_holidays', 'custom_holidays', 'holiday_periods', 'include_holidays')
ORDER BY ordinal_position;



