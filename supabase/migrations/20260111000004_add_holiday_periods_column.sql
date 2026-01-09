-- facility_settingsテーブルにholiday_periodsカラムを追加
ALTER TABLE facility_settings 
ADD COLUMN IF NOT EXISTS holiday_periods JSONB DEFAULT '[]'::jsonb;

-- コメント
COMMENT ON COLUMN facility_settings.holiday_periods IS '期間ごとの定休日設定（JSONB配列）';

