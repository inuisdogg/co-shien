-- =====================================================
-- attendance_records のRLSポリシー修正
-- Supabase Authを使用していないため、一旦開発用にオープンに
-- =====================================================

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "attendance_records_own_read_policy" ON attendance_records;
DROP POLICY IF EXISTS "attendance_records_facility_read_policy" ON attendance_records;
DROP POLICY IF EXISTS "attendance_records_own_insert_policy" ON attendance_records;
DROP POLICY IF EXISTS "attendance_records_own_update_policy" ON attendance_records;
DROP POLICY IF EXISTS "attendance_records_admin_update_policy" ON attendance_records;

-- 開発用：全アクセス許可（本番では適切なポリシーに変更必要）
CREATE POLICY "attendance_records_allow_all" ON attendance_records
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- facility_work_tool_settings も同様に修正
DROP POLICY IF EXISTS "facility_work_tool_settings_read_policy" ON facility_work_tool_settings;
DROP POLICY IF EXISTS "facility_work_tool_settings_manage_policy" ON facility_work_tool_settings;

CREATE POLICY "facility_work_tool_settings_allow_all" ON facility_work_tool_settings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- コメント
COMMENT ON POLICY "attendance_records_allow_all" ON attendance_records IS '開発用：全アクセス許可。本番環境では適切なRLSポリシーに変更してください。';
COMMENT ON POLICY "facility_work_tool_settings_allow_all" ON facility_work_tool_settings IS '開発用：全アクセス許可。本番環境では適切なRLSポリシーに変更してください。';
