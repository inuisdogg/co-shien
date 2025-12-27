-- 施設情報設定テーブル
-- facility_nameカラムを含む
CREATE TABLE IF NOT EXISTS facility_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  facility_id TEXT NOT NULL,
  facility_name TEXT,
  regular_holidays INTEGER[] DEFAULT ARRAY[0],
  custom_holidays TEXT[] DEFAULT ARRAY[]::TEXT[],
  business_hours JSONB NOT NULL DEFAULT '{"AM": {"start": "09:00", "end": "12:00"}, "PM": {"start": "13:00", "end": "18:00"}}',
  capacity JSONB NOT NULL DEFAULT '{"AM": 10, "PM": 10}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(facility_id)
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_facility_settings_facility_id ON facility_settings(facility_id);

-- Row Level Security (RLS) の設定（必要に応じて）
-- ALTER TABLE facility_settings ENABLE ROW LEVEL SECURITY;

-- ポリシーの設定例（全ユーザーが読み書き可能な場合）
-- CREATE POLICY "Allow all operations on facility_settings" ON facility_settings
--   FOR ALL
--   USING (true)
--   WITH CHECK (true);

