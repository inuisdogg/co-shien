-- =====================================================
-- attendance_records テーブル
-- スタッフの打刻記録（施設別勤怠管理）
-- =====================================================

-- 打刻タイプのENUM
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_type') THEN
    CREATE TYPE attendance_type AS ENUM ('start', 'end', 'break_start', 'break_end');
  END IF;
END$$;

-- テーブル作成
CREATE TABLE IF NOT EXISTS attendance_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,

  -- 勤務日
  date DATE NOT NULL,

  -- 打刻タイプ
  type attendance_type NOT NULL,

  -- 打刻時刻
  time TIME NOT NULL,

  -- 打刻した時点のタイムスタンプ（正確な記録用）
  recorded_at TIMESTAMPTZ DEFAULT NOW(),

  -- 手動修正フラグと理由
  is_manual_correction BOOLEAN DEFAULT FALSE,
  correction_reason TEXT,
  corrected_by TEXT REFERENCES users(id),

  -- 位置情報（オプション、将来の拡張用）
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),

  -- メモ
  memo TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 同一ユーザー・施設・日付・タイプで1レコードのみ
  UNIQUE(user_id, facility_id, date, type)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_attendance_records_user_facility
  ON attendance_records(user_id, facility_id);

CREATE INDEX IF NOT EXISTS idx_attendance_records_date
  ON attendance_records(date);

CREATE INDEX IF NOT EXISTS idx_attendance_records_user_date
  ON attendance_records(user_id, date);

CREATE INDEX IF NOT EXISTS idx_attendance_records_facility_date
  ON attendance_records(facility_id, date);

-- RLSポリシー
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- 自分の打刻記録を閲覧可能
CREATE POLICY "attendance_records_own_read_policy" ON attendance_records
  FOR SELECT
  USING (user_id = auth.uid()::TEXT);

-- 同じ施設の管理者は閲覧可能
CREATE POLICY "attendance_records_facility_read_policy" ON attendance_records
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.facility_id = attendance_records.facility_id
        AND s.user_id = auth.uid()::TEXT
        AND s.role IN ('admin', 'manager')
    )
  );

-- 自分の打刻記録を追加可能（その施設に所属している場合）
CREATE POLICY "attendance_records_own_insert_policy" ON attendance_records
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()::TEXT
    AND (
      EXISTS (
        SELECT 1 FROM staff s
        WHERE s.facility_id = attendance_records.facility_id
          AND s.user_id = auth.uid()::TEXT
      )
      OR
      EXISTS (
        SELECT 1 FROM employment_records er
        WHERE er.facility_id = attendance_records.facility_id
          AND er.user_id = auth.uid()::TEXT
          AND er.end_date IS NULL
      )
    )
  );

-- 自分の打刻記録を更新可能（手動修正フラグがないものに限る）
CREATE POLICY "attendance_records_own_update_policy" ON attendance_records
  FOR UPDATE
  USING (
    user_id = auth.uid()::TEXT
    AND is_manual_correction = FALSE
  );

-- 管理者は施設の打刻記録を修正可能
CREATE POLICY "attendance_records_admin_update_policy" ON attendance_records
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM staff s
      WHERE s.facility_id = attendance_records.facility_id
        AND s.user_id = auth.uid()::TEXT
        AND s.role IN ('admin', 'manager')
    )
  );

-- updated_at を自動更新するトリガー
CREATE OR REPLACE FUNCTION update_attendance_records_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_attendance_records_timestamp
  BEFORE UPDATE ON attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION update_attendance_records_timestamp();

-- 日次集計ビュー（パフォーマンス向上用）
CREATE OR REPLACE VIEW attendance_daily_summary AS
SELECT
  user_id,
  facility_id,
  date,
  MAX(CASE WHEN type = 'start' THEN time END) AS start_time,
  MAX(CASE WHEN type = 'end' THEN time END) AS end_time,
  MAX(CASE WHEN type = 'break_start' THEN time END) AS break_start_time,
  MAX(CASE WHEN type = 'break_end' THEN time END) AS break_end_time,
  CASE
    WHEN MAX(CASE WHEN type = 'end' THEN time END) IS NOT NULL THEN 'completed'
    WHEN MAX(CASE WHEN type = 'break_start' THEN time END) IS NOT NULL
      AND MAX(CASE WHEN type = 'break_end' THEN time END) IS NULL THEN 'on_break'
    WHEN MAX(CASE WHEN type = 'start' THEN time END) IS NOT NULL THEN 'working'
    ELSE 'not_started'
  END AS status
FROM attendance_records
GROUP BY user_id, facility_id, date;

-- コメント
COMMENT ON TABLE attendance_records IS 'スタッフの打刻記録（施設別勤怠管理）';
COMMENT ON COLUMN attendance_records.type IS '打刻タイプ: start=始業, end=退勤, break_start=休憩開始, break_end=休憩終了';
COMMENT ON COLUMN attendance_records.is_manual_correction IS '手動修正フラグ（管理者による修正の場合true）';
COMMENT ON COLUMN attendance_records.correction_reason IS '手動修正の理由';
COMMENT ON VIEW attendance_daily_summary IS '日次勤怠サマリービュー';
