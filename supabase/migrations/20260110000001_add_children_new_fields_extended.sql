-- 児童テーブルに新しいフィールドを追加
ALTER TABLE children 
ADD COLUMN IF NOT EXISTS name_kana TEXT,
ADD COLUMN IF NOT EXISTS guardian_name_kana TEXT,
ADD COLUMN IF NOT EXISTS pattern_time_slots JSONB,
ADD COLUMN IF NOT EXISTS registration_type TEXT CHECK (registration_type IN ('pre-contract', 'post-contract')),
ADD COLUMN IF NOT EXISTS planned_contract_days INTEGER,
ADD COLUMN IF NOT EXISTS planned_usage_start_date DATE,
ADD COLUMN IF NOT EXISTS planned_usage_days INTEGER;

-- コメント
COMMENT ON COLUMN children.name_kana IS '児童名（フリガナ）';
COMMENT ON COLUMN children.guardian_name_kana IS '保護者名（フリガナ）';
COMMENT ON COLUMN children.pattern_time_slots IS '曜日ごとの時間帯設定（JSONB: {0: "AM", 1: "PM", ...}）';
COMMENT ON COLUMN children.registration_type IS '登録タイプ: pre-contract(契約前), post-contract(契約後)';
COMMENT ON COLUMN children.planned_contract_days IS '契約予定日数（月間）';
COMMENT ON COLUMN children.planned_usage_start_date IS '利用開始予定日';
COMMENT ON COLUMN children.planned_usage_days IS '利用予定日数（総日数）';

