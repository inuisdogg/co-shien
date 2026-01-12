-- =============================================
-- 施設別時間枠テーブルの作成
-- 午前/午後の固定から施設ごとに柔軟な時間枠を設定可能に
-- =============================================

-- uuid-ossp拡張を有効化（既に有効な場合は何もしない）
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 施設別時間枠テーブル
CREATE TABLE IF NOT EXISTS facility_time_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,              -- "午前", "午後", "放課後" など
  start_time TIME NOT NULL,        -- 開始時間 (09:00)
  end_time TIME NOT NULL,          -- 終了時間 (12:00)
  capacity INTEGER DEFAULT 10,     -- 定員
  display_order INTEGER DEFAULT 0, -- 表示順
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 同一施設内で名前の重複を防ぐ
  UNIQUE(facility_id, name)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_facility_time_slots_facility_id
  ON facility_time_slots(facility_id);

CREATE INDEX IF NOT EXISTS idx_facility_time_slots_display_order
  ON facility_time_slots(facility_id, display_order);

-- RLSを有効化
ALTER TABLE facility_time_slots ENABLE ROW LEVEL SECURITY;

-- RLSポリシー
CREATE POLICY "facility_time_slots_select_policy" ON facility_time_slots
  FOR SELECT USING (true);

CREATE POLICY "facility_time_slots_insert_policy" ON facility_time_slots
  FOR INSERT WITH CHECK (true);

CREATE POLICY "facility_time_slots_update_policy" ON facility_time_slots
  FOR UPDATE USING (true);

CREATE POLICY "facility_time_slots_delete_policy" ON facility_time_slots
  FOR DELETE USING (true);

-- updated_at トリガー
CREATE OR REPLACE FUNCTION update_facility_time_slots_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_facility_time_slots_updated_at ON facility_time_slots;
CREATE TRIGGER trigger_facility_time_slots_updated_at
  BEFORE UPDATE ON facility_time_slots
  FOR EACH ROW
  EXECUTE FUNCTION update_facility_time_slots_updated_at();

-- =============================================
-- 既存施設にデフォルト時間枠を作成
-- =============================================
INSERT INTO facility_time_slots (facility_id, name, start_time, end_time, capacity, display_order)
SELECT
  f.id,
  slot.name,
  slot.start_time,
  slot.end_time,
  slot.capacity,
  slot.display_order
FROM facilities f
CROSS JOIN (
  VALUES
    ('午前', '09:00'::TIME, '12:00'::TIME, 10, 1),
    ('午後', '13:00'::TIME, '18:00'::TIME, 10, 2)
) AS slot(name, start_time, end_time, capacity, display_order)
ON CONFLICT (facility_id, name) DO NOTHING;

-- =============================================
-- childrenテーブルに郵便番号カラムを追加
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'children' AND column_name = 'postal_code'
  ) THEN
    ALTER TABLE children ADD COLUMN postal_code TEXT;
    COMMENT ON COLUMN children.postal_code IS '郵便番号（ハイフンなし7桁）';
  END IF;
END $$;

-- =============================================
-- コメント追加
-- =============================================
COMMENT ON TABLE facility_time_slots IS '施設別の利用時間枠設定。午前/午後の固定から柔軟な時間枠設定が可能。';
COMMENT ON COLUMN facility_time_slots.name IS '時間枠の名称（例: 午前、午後、放課後）';
COMMENT ON COLUMN facility_time_slots.start_time IS '開始時間';
COMMENT ON COLUMN facility_time_slots.end_time IS '終了時間';
COMMENT ON COLUMN facility_time_slots.capacity IS '定員数';
COMMENT ON COLUMN facility_time_slots.display_order IS '表示順序（小さい順に表示）';
