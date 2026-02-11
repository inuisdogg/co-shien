-- ============================================
-- 人員配置関連テーブルのRLS緩和（開発用）
-- 本番環境では適切なRLSに戻す必要あり
-- ============================================

-- staff_personnel_settings
DROP POLICY IF EXISTS "staff_personnel_select_v2" ON staff_personnel_settings;
DROP POLICY IF EXISTS "staff_personnel_insert_v2" ON staff_personnel_settings;
DROP POLICY IF EXISTS "staff_personnel_update_v2" ON staff_personnel_settings;
DROP POLICY IF EXISTS "staff_personnel_delete_v2" ON staff_personnel_settings;

CREATE POLICY "staff_personnel_all" ON staff_personnel_settings
FOR ALL USING (true) WITH CHECK (true);

-- daily_staffing_compliance
DROP POLICY IF EXISTS "daily_compliance_select_v2" ON daily_staffing_compliance;
DROP POLICY IF EXISTS "daily_compliance_insert_v2" ON daily_staffing_compliance;
DROP POLICY IF EXISTS "daily_compliance_update_v2" ON daily_staffing_compliance;
DROP POLICY IF EXISTS "daily_compliance_delete_v2" ON daily_staffing_compliance;

CREATE POLICY "daily_compliance_all" ON daily_staffing_compliance
FOR ALL USING (true) WITH CHECK (true);

-- work_schedule_reports
DROP POLICY IF EXISTS "work_schedule_reports_select_v2" ON work_schedule_reports;
DROP POLICY IF EXISTS "work_schedule_reports_insert_v2" ON work_schedule_reports;
DROP POLICY IF EXISTS "work_schedule_reports_update_v2" ON work_schedule_reports;
DROP POLICY IF EXISTS "work_schedule_reports_delete_v2" ON work_schedule_reports;

CREATE POLICY "work_schedule_reports_all" ON work_schedule_reports
FOR ALL USING (true) WITH CHECK (true);
