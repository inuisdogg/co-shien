-- ============================================
-- 施設設定テーブルの休業日設定を確認・修正
-- ============================================
-- holiday_periodsカラムが存在するか確認し、存在しない場合は追加
-- custom_holidaysの形式も確認
-- SupabaseのSQL Editorで実行してください
-- ============================================

-- 1. holiday_periodsカラムの確認と追加
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'facility_settings' AND column_name = 'holiday_periods') THEN
    ALTER TABLE facility_settings ADD COLUMN holiday_periods JSONB DEFAULT '[]'::jsonb;
    RAISE NOTICE 'holiday_periodsカラムを追加しました';
  ELSE
    RAISE NOTICE 'holiday_periodsカラムは既に存在します';
  END IF;
END $$;

-- 2. include_holidaysカラムの確認と追加
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'facility_settings' AND column_name = 'include_holidays') THEN
    ALTER TABLE facility_settings ADD COLUMN include_holidays BOOLEAN DEFAULT false;
    RAISE NOTICE 'include_holidaysカラムを追加しました';
  ELSE
    RAISE NOTICE 'include_holidaysカラムは既に存在します';
  END IF;
END $$;

-- 3. 現在のデータ構造を確認
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE '=== 施設設定データの確認 ===';
  FOR rec IN 
    SELECT 
      facility_id,
      facility_name,
      regular_holidays,
      custom_holidays,
      holiday_periods,
      include_holidays
    FROM facility_settings
    LIMIT 5
  LOOP
    RAISE NOTICE '施設ID: %', rec.facility_id;
    RAISE NOTICE '施設名: %', rec.facility_name;
    RAISE NOTICE 'regular_holidays: %', rec.regular_holidays;
    RAISE NOTICE 'custom_holidays: %', rec.custom_holidays;
    RAISE NOTICE 'holiday_periods: %', rec.holiday_periods;
    RAISE NOTICE 'include_holidays: %', rec.include_holidays;
    RAISE NOTICE '---';
  END LOOP;
END $$;

-- 4. カラムの型を確認
DO $$
DECLARE
  col_rec RECORD;
BEGIN
  RAISE NOTICE '=== カラム情報 ===';
  FOR col_rec IN 
    SELECT 
      column_name,
      data_type,
      udt_name
    FROM information_schema.columns
    WHERE table_name = 'facility_settings'
      AND column_name IN ('regular_holidays', 'custom_holidays', 'holiday_periods', 'include_holidays')
  LOOP
    RAISE NOTICE 'カラム名: %, 型: %, UDT: %', 
      col_rec.column_name, 
      col_rec.data_type, 
      col_rec.udt_name;
  END LOOP;
END $$;

-- ============================================
-- 完了メッセージ
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '施設設定テーブルの確認が完了しました！';
  RAISE NOTICE 'ブラウザのコンソールでデバッグログを確認してください。';
END $$;

