-- 施設設定テーブルにinclude_holidaysカラムを追加
ALTER TABLE facility_settings 
ADD COLUMN IF NOT EXISTS include_holidays BOOLEAN DEFAULT false;


