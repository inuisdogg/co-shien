-- ============================================
-- 施設設定テーブルの全カラム修復
-- 過去のマイグレーションで追加されるべきだったカラムを確実に追加
-- ============================================

-- スタッフ設定関連
ALTER TABLE facility_settings
  ADD COLUMN IF NOT EXISTS standard_weekly_hours NUMERIC(4,1) DEFAULT 40.0,
  ADD COLUMN IF NOT EXISTS manager_staff_id TEXT,
  ADD COLUMN IF NOT EXISTS service_manager_staff_id TEXT;

-- 報酬・加算関連
ALTER TABLE facility_settings
  ADD COLUMN IF NOT EXISTS service_type_code TEXT,
  ADD COLUMN IF NOT EXISTS regional_grade TEXT,
  ADD COLUMN IF NOT EXISTS treatment_improvement_grade TEXT;

-- 住所・位置情報
ALTER TABLE facility_settings
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS postal_code TEXT,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- 送迎能力
ALTER TABLE facility_settings
  ADD COLUMN IF NOT EXISTS transport_capacity JSONB DEFAULT '{"pickup": 4, "dropoff": 4}';

-- 祝日設定
ALTER TABLE facility_settings
  ADD COLUMN IF NOT EXISTS include_holidays BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS holiday_periods JSONB DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS business_hours_periods JSONB DEFAULT '[]'::JSONB;

-- サービス時間・事業区分（新形式）
ALTER TABLE facility_settings
  ADD COLUMN IF NOT EXISTS service_hours JSONB DEFAULT '{"AM": {"start": "09:00", "end": "12:00"}, "PM": {"start": "13:00", "end": "18:00"}}',
  ADD COLUMN IF NOT EXISTS service_categories JSONB DEFAULT '{"childDevelopmentSupport": false, "afterSchoolDayService": true, "nurseryVisitSupport": false, "homeBasedChildSupport": false}',
  ADD COLUMN IF NOT EXISTS flexible_business_hours JSONB DEFAULT '{"default": {"start": "09:00", "end": "18:00"}, "dayOverrides": {}}',
  ADD COLUMN IF NOT EXISTS flexible_service_hours JSONB DEFAULT '{"default": {"start": "09:00", "end": "18:00"}, "dayOverrides": {}}';

-- コメント追加
COMMENT ON COLUMN facility_settings.standard_weekly_hours IS '週あたり所定労働時間（常勤の基準）';
COMMENT ON COLUMN facility_settings.manager_staff_id IS '管理者のスタッフID';
COMMENT ON COLUMN facility_settings.service_manager_staff_id IS '児発管のスタッフID';
COMMENT ON COLUMN facility_settings.service_categories IS '事業区分（多機能型施設対応）';
COMMENT ON COLUMN facility_settings.flexible_business_hours IS '営業時間（曜日別対応）';
COMMENT ON COLUMN facility_settings.flexible_service_hours IS 'サービス提供時間（曜日別対応）';
