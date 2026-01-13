-- ============================================
-- シフト管理機能拡張
-- 希望シフト提出・再周知機能
-- ============================================

-- ============================================
-- 1. 希望シフト提出テーブル
-- ============================================
CREATE TABLE IF NOT EXISTS shift_availability_submissions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  available_dates TEXT[] NOT NULL DEFAULT '{}',  -- 出勤可能日の配列 ['2026-02-01', '2026-02-03', ...]
  notes TEXT,  -- 備考（希望事項など）
  submitted_at TIMESTAMPTZ,  -- 提出日時
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(facility_id, user_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_shift_availability_facility ON shift_availability_submissions(facility_id);
CREATE INDEX IF NOT EXISTS idx_shift_availability_user ON shift_availability_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_shift_availability_year_month ON shift_availability_submissions(year, month);

COMMENT ON TABLE shift_availability_submissions IS 'スタッフの希望シフト提出';
COMMENT ON COLUMN shift_availability_submissions.available_dates IS '出勤可能日の配列（YYYY-MM-DD形式）';
COMMENT ON COLUMN shift_availability_submissions.submitted_at IS '正式提出日時（NULLの場合は下書き）';

-- ============================================
-- 2. 希望提出締切設定テーブル
-- ============================================
CREATE TABLE IF NOT EXISTS shift_availability_deadlines (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  deadline_date DATE NOT NULL,  -- 締切日
  is_open BOOLEAN DEFAULT TRUE,  -- 提出受付中かどうか
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(facility_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_shift_deadline_facility ON shift_availability_deadlines(facility_id);
CREATE INDEX IF NOT EXISTS idx_shift_deadline_year_month ON shift_availability_deadlines(year, month);

COMMENT ON TABLE shift_availability_deadlines IS '希望シフト提出の締切設定';
COMMENT ON COLUMN shift_availability_deadlines.is_open IS 'trueの場合は提出受付中';

-- ============================================
-- 3. 既存テーブル変更: monthly_shift_schedules
-- ============================================
ALTER TABLE monthly_shift_schedules
  ADD COLUMN IF NOT EXISTS republished_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS republish_count INTEGER DEFAULT 0;

COMMENT ON COLUMN monthly_shift_schedules.republished_at IS '最終再周知日時';
COMMENT ON COLUMN monthly_shift_schedules.republish_count IS '再周知回数';

-- ============================================
-- 4. 既存テーブル変更: shift_confirmations
-- ============================================
ALTER TABLE shift_confirmations
  ADD COLUMN IF NOT EXISTS requires_reconfirm BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS previous_shift_pattern_id TEXT,
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

COMMENT ON COLUMN shift_confirmations.requires_reconfirm IS '再確認が必要かどうか';
COMMENT ON COLUMN shift_confirmations.previous_shift_pattern_id IS '変更前のシフトパターンID（差分検出用）';
COMMENT ON COLUMN shift_confirmations.version IS '確認バージョン（再周知対応）';

-- ============================================
-- 5. RLS設定
-- ============================================
ALTER TABLE shift_availability_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_availability_deadlines ENABLE ROW LEVEL SECURITY;

-- shift_availability_submissions RLS
DROP POLICY IF EXISTS "shift_availability_submissions_select" ON shift_availability_submissions;
CREATE POLICY "shift_availability_submissions_select" ON shift_availability_submissions FOR SELECT USING (true);

DROP POLICY IF EXISTS "shift_availability_submissions_insert" ON shift_availability_submissions;
CREATE POLICY "shift_availability_submissions_insert" ON shift_availability_submissions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "shift_availability_submissions_update" ON shift_availability_submissions;
CREATE POLICY "shift_availability_submissions_update" ON shift_availability_submissions FOR UPDATE USING (true);

DROP POLICY IF EXISTS "shift_availability_submissions_delete" ON shift_availability_submissions;
CREATE POLICY "shift_availability_submissions_delete" ON shift_availability_submissions FOR DELETE USING (true);

-- shift_availability_deadlines RLS
DROP POLICY IF EXISTS "shift_availability_deadlines_select" ON shift_availability_deadlines;
CREATE POLICY "shift_availability_deadlines_select" ON shift_availability_deadlines FOR SELECT USING (true);

DROP POLICY IF EXISTS "shift_availability_deadlines_insert" ON shift_availability_deadlines;
CREATE POLICY "shift_availability_deadlines_insert" ON shift_availability_deadlines FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "shift_availability_deadlines_update" ON shift_availability_deadlines;
CREATE POLICY "shift_availability_deadlines_update" ON shift_availability_deadlines FOR UPDATE USING (true);

DROP POLICY IF EXISTS "shift_availability_deadlines_delete" ON shift_availability_deadlines;
CREATE POLICY "shift_availability_deadlines_delete" ON shift_availability_deadlines FOR DELETE USING (true);

-- ============================================
-- 6. シフト公開時に通知を作成するトリガー
-- ============================================
CREATE OR REPLACE FUNCTION create_shift_publish_notifications()
RETURNS TRIGGER AS $$
BEGIN
  -- 公開または再周知時に通知作成
  IF NEW.status = 'published' AND (
    (OLD.status IS NULL OR OLD.status = 'draft') OR
    (NEW.republished_at IS NOT NULL AND NEW.republished_at IS DISTINCT FROM OLD.republished_at)
  ) THEN
    -- 該当月のシフトがあるスタッフに通知
    INSERT INTO notifications (facility_id, user_id, type, title, message)
    SELECT DISTINCT
      NEW.facility_id,
      st.user_id,
      CASE WHEN NEW.republish_count > 0 THEN 'shift_republished' ELSE 'shift_published' END,
      CASE WHEN NEW.republish_count > 0 THEN
        NEW.year || '年' || NEW.month || '月のシフトが再周知されました'
      ELSE
        NEW.year || '年' || NEW.month || '月のシフトが公開されました'
      END,
      '確認して回答してください'
    FROM shifts s
    INNER JOIN staff st ON s.staff_id = st.id
    WHERE s.monthly_schedule_id = NEW.id
      AND s.has_shift = true
      AND st.user_id IS NOT NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_shift_publish_notifications ON monthly_shift_schedules;
CREATE TRIGGER trigger_create_shift_publish_notifications
  AFTER UPDATE ON monthly_shift_schedules
  FOR EACH ROW
  EXECUTE FUNCTION create_shift_publish_notifications();

-- ============================================
-- 7. 再周知時に変更箇所の確認をリセットするトリガー
-- ============================================
CREATE OR REPLACE FUNCTION reset_confirmations_on_republish()
RETURNS TRIGGER AS $$
BEGIN
  -- 再周知された場合のみ処理
  IF NEW.status = 'published' AND OLD.status = 'published' AND
     NEW.republished_at IS NOT NULL AND NEW.republished_at IS DISTINCT FROM OLD.republished_at THEN

    -- まず現在のシフトパターンIDを記録（変更前）
    UPDATE shift_confirmations sc
    SET previous_shift_pattern_id = s.shift_pattern_id
    FROM shifts s
    WHERE sc.shift_id = s.id
      AND s.monthly_schedule_id = NEW.id
      AND sc.previous_shift_pattern_id IS NULL;

    -- シフト内容が変更されたもの、または相談中のものをリセット
    UPDATE shift_confirmations sc
    SET
      requires_reconfirm = TRUE,
      status = 'pending',
      responded_at = NULL,
      comment = NULL,
      version = COALESCE(sc.version, 1) + 1,
      updated_at = NOW()
    FROM shifts s
    WHERE sc.shift_id = s.id
      AND s.monthly_schedule_id = NEW.id
      AND (
        sc.previous_shift_pattern_id IS DISTINCT FROM s.shift_pattern_id
        OR sc.status = 'needs_discussion'
      );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_reset_confirmations_on_republish ON monthly_shift_schedules;
CREATE TRIGGER trigger_reset_confirmations_on_republish
  AFTER UPDATE ON monthly_shift_schedules
  FOR EACH ROW
  EXECUTE FUNCTION reset_confirmations_on_republish();
