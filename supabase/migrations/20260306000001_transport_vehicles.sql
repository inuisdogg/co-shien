-- 送迎車両管理 + カード型スケジュールUI対応
-- schedules: pickup_method/dropoff_method 追加
-- children: transport_pattern 追加
-- facility_children_settings: transport_pattern 追加
-- facility_settings: transport_vehicles 追加

-- schedules テーブルに送迎方法カラム追加
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS pickup_method TEXT;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS dropoff_method TEXT;

-- children テーブルに曜日別送迎パターン追加
ALTER TABLE children ADD COLUMN IF NOT EXISTS transport_pattern JSONB;

-- facility_children_settings テーブルにも同様
ALTER TABLE facility_children_settings ADD COLUMN IF NOT EXISTS transport_pattern JSONB;

-- facility_settings テーブルに送迎車両情報追加
ALTER TABLE facility_settings ADD COLUMN IF NOT EXISTS transport_vehicles JSONB;
