-- ============================================
-- 施設設定にサービス提供時間と事業区分を追加
-- 曜日別の営業時間・サービス提供時間に対応
-- ============================================

-- サービス提供時間カラムを追加（旧形式：後方互換性のため保持）
ALTER TABLE facility_settings
ADD COLUMN IF NOT EXISTS service_hours JSONB DEFAULT '{"AM": {"start": "09:00", "end": "12:00"}, "PM": {"start": "13:00", "end": "18:00"}}';

-- 事業区分カラムを追加
ALTER TABLE facility_settings
ADD COLUMN IF NOT EXISTS service_categories JSONB DEFAULT '{"childDevelopmentSupport": false, "afterSchoolDayService": true, "nurseryVisitSupport": false, "homeBasedChildSupport": false}';

-- 柔軟な営業時間カラムを追加（新形式：曜日別対応）
ALTER TABLE facility_settings
ADD COLUMN IF NOT EXISTS flexible_business_hours JSONB DEFAULT '{"default": {"start": "09:00", "end": "18:00"}, "dayOverrides": {}}';

-- 柔軟なサービス提供時間カラムを追加（新形式：曜日別対応）
ALTER TABLE facility_settings
ADD COLUMN IF NOT EXISTS flexible_service_hours JSONB DEFAULT '{"default": {"start": "09:00", "end": "18:00"}, "dayOverrides": {}}';

-- コメント追加
COMMENT ON COLUMN facility_settings.service_hours IS 'サービス提供時間（運営規定用・旧形式）: 職員が配置されサービス提供可能な時間';
COMMENT ON COLUMN facility_settings.service_categories IS '事業区分（多機能型施設対応）: 児童発達支援、放課後等デイサービス、保育所等訪問支援、居宅訪問型児童発達支援';
COMMENT ON COLUMN facility_settings.flexible_business_hours IS '営業時間（新形式・曜日別対応）: defaultはデフォルト時間、dayOverridesは曜日別の例外設定（0=日,1=月,...,6=土）';
COMMENT ON COLUMN facility_settings.flexible_service_hours IS 'サービス提供時間（新形式・曜日別対応）: defaultはデフォルト時間、dayOverridesは曜日別の例外設定（0=日,1=月,...,6=土）';
