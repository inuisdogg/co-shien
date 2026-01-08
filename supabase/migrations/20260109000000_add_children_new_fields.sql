-- 児童テーブルに新しいフィールドを追加
-- 生年月日、利用パターン（曜日配列）、送迎場所（自由記入）、特性・メモ

ALTER TABLE children 
ADD COLUMN IF NOT EXISTS birth_date DATE,
ADD COLUMN IF NOT EXISTS pattern_days JSONB,
ADD COLUMN IF NOT EXISTS pickup_location_custom TEXT,
ADD COLUMN IF NOT EXISTS dropoff_location_custom TEXT,
ADD COLUMN IF NOT EXISTS characteristics TEXT;

-- 既存のpattern_daysがNULLの場合、pattern文字列から推測して設定（オプション）
-- これは既存データの移行用（必要に応じて実行）

COMMENT ON COLUMN children.birth_date IS '生年月日';
COMMENT ON COLUMN children.pattern_days IS '基本利用パターン（曜日の配列: 0=日, 1=月, ..., 6=土）';
COMMENT ON COLUMN children.pickup_location_custom IS '乗車地（自由記入）';
COMMENT ON COLUMN children.dropoff_location_custom IS '降車地（自由記入）';
COMMENT ON COLUMN children.characteristics IS '特性・メモ';

