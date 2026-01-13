-- =====================================================
-- facility_work_tool_settings テーブル
-- 施設ごとの業務ツール表示設定
-- =====================================================

-- テーブル作成
CREATE TABLE IF NOT EXISTS facility_work_tool_settings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,

  -- 各ツールの有効/無効設定
  enabled_tools JSONB NOT NULL DEFAULT '{
    "time_tracking": true,
    "daily_report": true,
    "expense": true,
    "document_output": true,
    "attendance_calendar": true,
    "shift_view": false,
    "training_record": true,
    "announcements": true,
    "task_management": false
  }'::JSONB,

  -- ツールの表示順序（オプション）
  tool_order TEXT[] DEFAULT ARRAY[
    'time_tracking',
    'daily_report',
    'expense',
    'document_output',
    'attendance_calendar',
    'shift_view',
    'training_record',
    'announcements',
    'task_management'
  ],

  -- カスタム設定（将来の拡張用）
  custom_settings JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 施設ごとに1レコードのみ
  UNIQUE(facility_id)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_facility_work_tool_settings_facility
  ON facility_work_tool_settings(facility_id);

-- RLSポリシー
ALTER TABLE facility_work_tool_settings ENABLE ROW LEVEL SECURITY;

-- 施設スタッフ（管理者）が設定を閲覧・編集可能
CREATE POLICY "facility_work_tool_settings_read_policy" ON facility_work_tool_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.facility_id = facility_work_tool_settings.facility_id
        AND s.user_id = auth.uid()::TEXT
    )
    OR
    EXISTS (
      SELECT 1 FROM employment_records er
      WHERE er.facility_id = facility_work_tool_settings.facility_id
        AND er.user_id = auth.uid()::TEXT
        AND er.end_date IS NULL
    )
  );

CREATE POLICY "facility_work_tool_settings_manage_policy" ON facility_work_tool_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.facility_id = facility_work_tool_settings.facility_id
        AND s.user_id = auth.uid()::TEXT
        AND s.role IN ('admin', 'manager')
    )
  );

-- updated_at を自動更新するトリガー
CREATE OR REPLACE FUNCTION update_facility_work_tool_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_facility_work_tool_settings_timestamp
  BEFORE UPDATE ON facility_work_tool_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_facility_work_tool_settings_timestamp();

-- デモ施設のデフォルト設定を追加
INSERT INTO facility_work_tool_settings (facility_id, enabled_tools, tool_order)
SELECT
  id,
  '{
    "time_tracking": true,
    "daily_report": true,
    "expense": true,
    "document_output": true,
    "attendance_calendar": true,
    "shift_view": false,
    "training_record": true,
    "announcements": true,
    "task_management": false
  }'::JSONB,
  ARRAY['time_tracking', 'daily_report', 'expense', 'document_output', 'attendance_calendar', 'shift_view', 'training_record', 'announcements', 'task_management']
FROM facilities
WHERE id LIKE 'facility-demo-%'
ON CONFLICT (facility_id) DO NOTHING;

-- コメント
COMMENT ON TABLE facility_work_tool_settings IS '施設ごとの業務ツール表示設定';
COMMENT ON COLUMN facility_work_tool_settings.enabled_tools IS '各ツールの有効/無効設定（JSONB）';
COMMENT ON COLUMN facility_work_tool_settings.tool_order IS 'ツールの表示順序';
COMMENT ON COLUMN facility_work_tool_settings.custom_settings IS 'カスタム設定（将来の拡張用）';
