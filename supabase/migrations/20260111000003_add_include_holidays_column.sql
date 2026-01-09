-- ============================================
-- facility_settingsテーブルにinclude_holidaysカラムを追加
-- ============================================

-- include_holidaysカラムが存在しない場合のみ追加
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'facility_settings' 
    AND column_name = 'include_holidays'
  ) THEN
    ALTER TABLE facility_settings 
    ADD COLUMN include_holidays BOOLEAN DEFAULT false;
  END IF;
END $$;

