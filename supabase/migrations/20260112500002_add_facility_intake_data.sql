-- 施設側で入力した児童情報を保存するカラムを追加
-- 利用者アカウント連携時に、施設がヒアリングした情報を別途保管

ALTER TABLE children ADD COLUMN IF NOT EXISTS facility_intake_data JSONB;

COMMENT ON COLUMN children.facility_intake_data IS '施設側で入力した児童情報（利用者連携前のヒアリング情報）。連携後も参照用に保持。';

-- 施設記録のタイムスタンプ
ALTER TABLE children ADD COLUMN IF NOT EXISTS facility_intake_recorded_at TIMESTAMPTZ;
ALTER TABLE children ADD COLUMN IF NOT EXISTS facility_intake_recorded_by TEXT;

COMMENT ON COLUMN children.facility_intake_recorded_at IS '施設記録が保存された日時';
COMMENT ON COLUMN children.facility_intake_recorded_by IS '施設記録を入力したスタッフID';
