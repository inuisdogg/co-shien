-- 施設設定の変更履歴テーブル
CREATE TABLE IF NOT EXISTS facility_settings_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL CHECK (change_type IN ('business_hours', 'holidays', 'capacity', 'all')),
  old_value JSONB,
  new_value JSONB,
  changed_by TEXT REFERENCES users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_facility_settings_history_facility_id ON facility_settings_history(facility_id);
CREATE INDEX IF NOT EXISTS idx_facility_settings_history_changed_at ON facility_settings_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_facility_settings_history_change_type ON facility_settings_history(change_type);

-- RLS設定
ALTER TABLE facility_settings_history ENABLE ROW LEVEL SECURITY;

-- facility_settingsテーブルが存在しない場合は作成
CREATE TABLE IF NOT EXISTS facility_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id TEXT NOT NULL,
  facility_name TEXT,
  regular_holidays INTEGER[] DEFAULT ARRAY[0],
  custom_holidays TEXT[] DEFAULT ARRAY[]::TEXT[],
  business_hours JSONB NOT NULL DEFAULT '{"AM": {"start": "09:00", "end": "12:00"}, "PM": {"start": "13:00", "end": "18:00"}}',
  capacity JSONB NOT NULL DEFAULT '{"AM": 10, "PM": 10}',
  business_hours_periods JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(facility_id)
);

-- 施設設定テーブルに営業時間の期間設定カラムを追加（既に存在する場合）
ALTER TABLE facility_settings 
ADD COLUMN IF NOT EXISTS business_hours_periods JSONB DEFAULT '[]'::jsonb;

-- コメント
COMMENT ON TABLE facility_settings_history IS '施設設定の変更履歴を保存するテーブル';
COMMENT ON COLUMN facility_settings_history.change_type IS '変更タイプ: business_hours(営業時間), holidays(定休日), capacity(定員), all(全て)';
COMMENT ON COLUMN facility_settings_history.old_value IS '変更前の値（JSON形式）';
COMMENT ON COLUMN facility_settings_history.new_value IS '変更後の値（JSON形式）';
COMMENT ON COLUMN facility_settings.business_hours_periods IS '期間ごとの営業時間設定（JSONB配列）';

