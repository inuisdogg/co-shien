-- ============================================
-- 施設設定カラム修復
-- 以前のマイグレーションが正しく適用されていなかった可能性があるため再実行
-- ============================================

-- サービス提供時間カラム
ALTER TABLE facility_settings
ADD COLUMN IF NOT EXISTS service_hours JSONB DEFAULT '{"AM": {"start": "09:00", "end": "12:00"}, "PM": {"start": "13:00", "end": "18:00"}}';

-- 事業区分カラム
ALTER TABLE facility_settings
ADD COLUMN IF NOT EXISTS service_categories JSONB DEFAULT '{"childDevelopmentSupport": false, "afterSchoolDayService": true, "nurseryVisitSupport": false, "homeBasedChildSupport": false}';

-- 柔軟な営業時間カラム
ALTER TABLE facility_settings
ADD COLUMN IF NOT EXISTS flexible_business_hours JSONB DEFAULT '{"default": {"start": "09:00", "end": "18:00"}, "dayOverrides": {}}';

-- 柔軟なサービス提供時間カラム
ALTER TABLE facility_settings
ADD COLUMN IF NOT EXISTS flexible_service_hours JSONB DEFAULT '{"default": {"start": "09:00", "end": "18:00"}, "dayOverrides": {}}';
