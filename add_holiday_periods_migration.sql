-- 施設設定テーブルにholiday_periodsカラムを追加
ALTER TABLE facility_settings 
ADD COLUMN IF NOT EXISTS holiday_periods JSONB DEFAULT '[]'::jsonb;

