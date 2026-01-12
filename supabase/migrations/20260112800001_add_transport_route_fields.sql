-- 送迎ルート機能のためのフィールド追加
-- facility_settings: 施設住所・送迎可能人数
-- children: 送迎場所の住所・座標

-- ============================================
-- facility_settings テーブル拡張
-- ============================================

-- 施設住所（送迎の起点/終点）
ALTER TABLE facility_settings ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE facility_settings ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE facility_settings ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE facility_settings ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- 送迎設定（1回の送迎で乗車できる最大人数）
ALTER TABLE facility_settings ADD COLUMN IF NOT EXISTS transport_capacity JSONB DEFAULT '{"pickup": 4, "dropoff": 4}';

-- ============================================
-- children テーブル拡張
-- ============================================

-- お迎え場所の住所・座標
ALTER TABLE children ADD COLUMN IF NOT EXISTS pickup_address TEXT;
ALTER TABLE children ADD COLUMN IF NOT EXISTS pickup_postal_code TEXT;
ALTER TABLE children ADD COLUMN IF NOT EXISTS pickup_latitude DOUBLE PRECISION;
ALTER TABLE children ADD COLUMN IF NOT EXISTS pickup_longitude DOUBLE PRECISION;

-- お送り場所の住所・座標
ALTER TABLE children ADD COLUMN IF NOT EXISTS dropoff_address TEXT;
ALTER TABLE children ADD COLUMN IF NOT EXISTS dropoff_postal_code TEXT;
ALTER TABLE children ADD COLUMN IF NOT EXISTS dropoff_latitude DOUBLE PRECISION;
ALTER TABLE children ADD COLUMN IF NOT EXISTS dropoff_longitude DOUBLE PRECISION;

-- コメント追加
COMMENT ON COLUMN facility_settings.address IS '施設住所（送迎の起点/終点）';
COMMENT ON COLUMN facility_settings.postal_code IS '施設の郵便番号';
COMMENT ON COLUMN facility_settings.latitude IS '施設の緯度（Google Maps用）';
COMMENT ON COLUMN facility_settings.longitude IS '施設の経度（Google Maps用）';
COMMENT ON COLUMN facility_settings.transport_capacity IS '送迎可能人数 {"pickup": number, "dropoff": number}';

COMMENT ON COLUMN children.pickup_address IS 'お迎え場所の住所';
COMMENT ON COLUMN children.pickup_postal_code IS 'お迎え場所の郵便番号';
COMMENT ON COLUMN children.pickup_latitude IS 'お迎え場所の緯度（Google Maps用）';
COMMENT ON COLUMN children.pickup_longitude IS 'お迎え場所の経度（Google Maps用）';
COMMENT ON COLUMN children.dropoff_address IS 'お送り場所の住所';
COMMENT ON COLUMN children.dropoff_postal_code IS 'お送り場所の郵便番号';
COMMENT ON COLUMN children.dropoff_latitude IS 'お送り場所の緯度（Google Maps用）';
COMMENT ON COLUMN children.dropoff_longitude IS 'お送り場所の経度（Google Maps用）';
