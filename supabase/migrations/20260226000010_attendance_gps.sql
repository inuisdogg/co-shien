-- =====================================================
-- GPS Geofencing for Attendance Records
-- 打刻時のGPSジオフェンス検証カラム追加
-- =====================================================

-- 1. attendance_records テーブルにジオフェンス検証結果カラムを追加
-- location_lat / location_lng は既存（20260113000002で作成済み）

DO $$
BEGIN
  -- ジオフェンス検証結果フラグ
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance_records' AND column_name = 'geo_validated'
  ) THEN
    ALTER TABLE attendance_records
      ADD COLUMN geo_validated BOOLEAN DEFAULT FALSE;
  END IF;

  -- 施設との距離（メートル）
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance_records' AND column_name = 'geo_distance_meters'
  ) THEN
    ALTER TABLE attendance_records
      ADD COLUMN geo_distance_meters NUMERIC(8,1);
  END IF;
END$$;

-- 2. facility_settings テーブルにジオフェンス半径カラムを追加
-- latitude / longitude は既存（20260112800001で作成済み）

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facility_settings' AND column_name = 'geofence_radius_meters'
  ) THEN
    ALTER TABLE facility_settings
      ADD COLUMN geofence_radius_meters INTEGER DEFAULT 500;
  END IF;
END$$;

-- コメント追加
COMMENT ON COLUMN attendance_records.geo_validated IS 'GPS位置情報によるジオフェンス検証結果（true=施設範囲内で打刻）';
COMMENT ON COLUMN attendance_records.geo_distance_meters IS '打刻時の施設からの距離（メートル）';
COMMENT ON COLUMN facility_settings.geofence_radius_meters IS 'ジオフェンス許容半径（メートル、デフォルト500m）';
