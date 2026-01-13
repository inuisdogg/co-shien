-- ============================================
-- シフト管理システムテーブル
-- シフトパターン、月間スケジュール、確認機能
-- ============================================

-- ============================================
-- 1. シフトパターン定義
-- ============================================
CREATE TABLE IF NOT EXISTS shift_patterns (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,           -- '早番', '遅番' 等
  short_name TEXT,              -- '早', '遅' 等（カレンダー表示用）
  start_time TIME,              -- 開始時刻
  end_time TIME,                -- 終了時刻
  break_minutes INTEGER DEFAULT 60,  -- 休憩時間（分）
  color TEXT DEFAULT '#00c4cc', -- 表示色
  display_order INTEGER DEFAULT 0,   -- 表示順
  is_day_off BOOLEAN DEFAULT FALSE,  -- 休日パターンかどうか
  is_active BOOLEAN DEFAULT TRUE,    -- 有効フラグ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(facility_id, name)
);

CREATE INDEX IF NOT EXISTS idx_shift_patterns_facility ON shift_patterns(facility_id);
CREATE INDEX IF NOT EXISTS idx_shift_patterns_active ON shift_patterns(facility_id, is_active);

COMMENT ON TABLE shift_patterns IS '施設ごとのシフトパターン定義';
COMMENT ON COLUMN shift_patterns.short_name IS 'カレンダー表示用の短縮名';
COMMENT ON COLUMN shift_patterns.is_day_off IS '公休・休日パターンの場合true';

-- ============================================
-- 2. 月間シフトスケジュール
-- ============================================
CREATE TABLE IF NOT EXISTS monthly_shift_schedules (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'confirmed')),
  published_at TIMESTAMPTZ,     -- 公開日時
  confirmed_at TIMESTAMPTZ,     -- 確定日時
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(facility_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_shift_schedules_facility ON monthly_shift_schedules(facility_id);
CREATE INDEX IF NOT EXISTS idx_monthly_shift_schedules_year_month ON monthly_shift_schedules(year, month);
CREATE INDEX IF NOT EXISTS idx_monthly_shift_schedules_status ON monthly_shift_schedules(status);

COMMENT ON TABLE monthly_shift_schedules IS '月間シフトスケジュールの管理状態';
COMMENT ON COLUMN monthly_shift_schedules.status IS 'draft=作成中, published=公開済み, confirmed=確定';

-- ============================================
-- 3. shifts テーブル拡張
-- ============================================
ALTER TABLE shifts
  ADD COLUMN IF NOT EXISTS shift_pattern_id TEXT REFERENCES shift_patterns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS monthly_schedule_id TEXT REFERENCES monthly_shift_schedules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS end_time TIME,
  ADD COLUMN IF NOT EXISTS break_minutes INTEGER;

CREATE INDEX IF NOT EXISTS idx_shifts_pattern ON shifts(shift_pattern_id);
CREATE INDEX IF NOT EXISTS idx_shifts_schedule ON shifts(monthly_schedule_id);

COMMENT ON COLUMN shifts.shift_pattern_id IS '適用されたシフトパターン';
COMMENT ON COLUMN shifts.monthly_schedule_id IS '所属する月間スケジュール';

-- ============================================
-- 4. シフト確認（スタッフ回答）
-- ============================================
CREATE TABLE IF NOT EXISTS shift_confirmations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  shift_id TEXT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'needs_discussion')),
  comment TEXT,                  -- 相談内容
  responded_at TIMESTAMPTZ,      -- 回答日時
  resolved_at TIMESTAMPTZ,       -- 相談解決日時
  resolution_note TEXT,          -- 解決メモ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shift_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_shift_confirmations_shift ON shift_confirmations(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_confirmations_user ON shift_confirmations(user_id);
CREATE INDEX IF NOT EXISTS idx_shift_confirmations_status ON shift_confirmations(status);

COMMENT ON TABLE shift_confirmations IS 'スタッフのシフト確認回答';
COMMENT ON COLUMN shift_confirmations.status IS 'pending=未回答, confirmed=OK, needs_discussion=相談したい';

-- ============================================
-- 5. スタッフ別休暇設定
-- ============================================
CREATE TABLE IF NOT EXISTS staff_leave_settings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- 有給休暇
  paid_leave_enabled BOOLEAN DEFAULT FALSE,
  paid_leave_days NUMERIC(4,1) DEFAULT 0,
  -- 代休
  substitute_leave_enabled BOOLEAN DEFAULT FALSE,
  substitute_leave_days NUMERIC(4,1) DEFAULT 0,
  -- メモ
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(facility_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_leave_settings_facility ON staff_leave_settings(facility_id);
CREATE INDEX IF NOT EXISTS idx_staff_leave_settings_user ON staff_leave_settings(user_id);

COMMENT ON TABLE staff_leave_settings IS 'スタッフ別の休暇設定（有給付与有無など）';
COMMENT ON COLUMN staff_leave_settings.paid_leave_enabled IS '有給休暇が利用可能か';
COMMENT ON COLUMN staff_leave_settings.paid_leave_days IS '有給残日数';
COMMENT ON COLUMN staff_leave_settings.substitute_leave_enabled IS '代休が利用可能か';
COMMENT ON COLUMN staff_leave_settings.substitute_leave_days IS '代休残日数';

-- ============================================
-- 6. RLS設定
-- ============================================
ALTER TABLE shift_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_shift_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_leave_settings ENABLE ROW LEVEL SECURITY;

-- shift_patterns RLS
DROP POLICY IF EXISTS "shift_patterns_select" ON shift_patterns;
CREATE POLICY "shift_patterns_select" ON shift_patterns FOR SELECT USING (true);

DROP POLICY IF EXISTS "shift_patterns_insert" ON shift_patterns;
CREATE POLICY "shift_patterns_insert" ON shift_patterns FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "shift_patterns_update" ON shift_patterns;
CREATE POLICY "shift_patterns_update" ON shift_patterns FOR UPDATE USING (true);

DROP POLICY IF EXISTS "shift_patterns_delete" ON shift_patterns;
CREATE POLICY "shift_patterns_delete" ON shift_patterns FOR DELETE USING (true);

-- monthly_shift_schedules RLS
DROP POLICY IF EXISTS "monthly_shift_schedules_select" ON monthly_shift_schedules;
CREATE POLICY "monthly_shift_schedules_select" ON monthly_shift_schedules FOR SELECT USING (true);

DROP POLICY IF EXISTS "monthly_shift_schedules_insert" ON monthly_shift_schedules;
CREATE POLICY "monthly_shift_schedules_insert" ON monthly_shift_schedules FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "monthly_shift_schedules_update" ON monthly_shift_schedules;
CREATE POLICY "monthly_shift_schedules_update" ON monthly_shift_schedules FOR UPDATE USING (true);

DROP POLICY IF EXISTS "monthly_shift_schedules_delete" ON monthly_shift_schedules;
CREATE POLICY "monthly_shift_schedules_delete" ON monthly_shift_schedules FOR DELETE USING (true);

-- shift_confirmations RLS
DROP POLICY IF EXISTS "shift_confirmations_select" ON shift_confirmations;
CREATE POLICY "shift_confirmations_select" ON shift_confirmations FOR SELECT USING (true);

DROP POLICY IF EXISTS "shift_confirmations_insert" ON shift_confirmations;
CREATE POLICY "shift_confirmations_insert" ON shift_confirmations FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "shift_confirmations_update" ON shift_confirmations;
CREATE POLICY "shift_confirmations_update" ON shift_confirmations FOR UPDATE USING (true);

DROP POLICY IF EXISTS "shift_confirmations_delete" ON shift_confirmations;
CREATE POLICY "shift_confirmations_delete" ON shift_confirmations FOR DELETE USING (true);

-- staff_leave_settings RLS
DROP POLICY IF EXISTS "staff_leave_settings_select" ON staff_leave_settings;
CREATE POLICY "staff_leave_settings_select" ON staff_leave_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "staff_leave_settings_insert" ON staff_leave_settings;
CREATE POLICY "staff_leave_settings_insert" ON staff_leave_settings FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "staff_leave_settings_update" ON staff_leave_settings;
CREATE POLICY "staff_leave_settings_update" ON staff_leave_settings FOR UPDATE USING (true);

DROP POLICY IF EXISTS "staff_leave_settings_delete" ON staff_leave_settings;
CREATE POLICY "staff_leave_settings_delete" ON staff_leave_settings FOR DELETE USING (true);

-- ============================================
-- 7. シフト公開時に確認レコードを自動生成するトリガー
-- ============================================
CREATE OR REPLACE FUNCTION create_shift_confirmations_on_publish()
RETURNS TRIGGER AS $$
BEGIN
  -- 公開された場合のみ処理
  IF NEW.status = 'published' AND (OLD.status IS NULL OR OLD.status = 'draft') THEN
    -- 該当月のシフトに対して確認レコードを作成
    INSERT INTO shift_confirmations (shift_id, user_id, status)
    SELECT
      s.id,
      st.user_id,
      'pending'
    FROM shifts s
    INNER JOIN staff st ON s.staff_id = st.id
    WHERE s.monthly_schedule_id = NEW.id
      AND s.has_shift = true
    ON CONFLICT (shift_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_shift_confirmations ON monthly_shift_schedules;
CREATE TRIGGER trigger_create_shift_confirmations
  AFTER UPDATE ON monthly_shift_schedules
  FOR EACH ROW
  EXECUTE FUNCTION create_shift_confirmations_on_publish();
