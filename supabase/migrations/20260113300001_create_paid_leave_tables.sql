-- ============================================
-- 有給休暇管理テーブル
-- ============================================

-- ============================================
-- 1. 有給休暇残日数テーブル
-- ============================================
CREATE TABLE IF NOT EXISTS paid_leave_balances (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  fiscal_year INTEGER NOT NULL, -- 年度（例: 2026）
  total_days NUMERIC(4,1) NOT NULL DEFAULT 0, -- 付与日数
  used_days NUMERIC(4,1) NOT NULL DEFAULT 0, -- 使用日数
  remaining_days NUMERIC(4,1) GENERATED ALWAYS AS (total_days - used_days) STORED, -- 残日数
  granted_date DATE, -- 付与日
  expires_date DATE, -- 有効期限
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, facility_id, fiscal_year)
);

CREATE INDEX IF NOT EXISTS idx_paid_leave_balances_user ON paid_leave_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_paid_leave_balances_facility ON paid_leave_balances(facility_id);
CREATE INDEX IF NOT EXISTS idx_paid_leave_balances_year ON paid_leave_balances(fiscal_year);

COMMENT ON TABLE paid_leave_balances IS '有給休暇残日数管理';
COMMENT ON COLUMN paid_leave_balances.total_days IS '年度の付与日数';
COMMENT ON COLUMN paid_leave_balances.used_days IS '使用済み日数';
COMMENT ON COLUMN paid_leave_balances.remaining_days IS '残日数（自動計算）';

-- ============================================
-- 2. 有給休暇申請テーブル
-- ============================================
CREATE TABLE IF NOT EXISTS leave_requests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL DEFAULT 'paid_leave' CHECK (request_type IN ('paid_leave', 'half_day_am', 'half_day_pm', 'special_leave', 'sick_leave', 'absence')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count NUMERIC(4,1) NOT NULL DEFAULT 1, -- 日数（半休の場合0.5）
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  approved_by TEXT REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_user ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_facility ON leave_requests(facility_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON leave_requests(start_date, end_date);

COMMENT ON TABLE leave_requests IS '休暇申請';
COMMENT ON COLUMN leave_requests.request_type IS '申請種別: paid_leave=有給, half_day_am=午前半休, half_day_pm=午後半休, special_leave=特別休暇, sick_leave=病欠, absence=欠勤';
COMMENT ON COLUMN leave_requests.days_count IS '日数（全日=1, 半休=0.5）';

-- ============================================
-- 3. RLS設定
-- ============================================
ALTER TABLE paid_leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

-- 有給残日数のRLS
DROP POLICY IF EXISTS "paid_leave_balances_select" ON paid_leave_balances;
CREATE POLICY "paid_leave_balances_select" ON paid_leave_balances FOR SELECT USING (true);

DROP POLICY IF EXISTS "paid_leave_balances_insert" ON paid_leave_balances;
CREATE POLICY "paid_leave_balances_insert" ON paid_leave_balances FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "paid_leave_balances_update" ON paid_leave_balances;
CREATE POLICY "paid_leave_balances_update" ON paid_leave_balances FOR UPDATE USING (true);

-- 休暇申請のRLS
DROP POLICY IF EXISTS "leave_requests_select" ON leave_requests;
CREATE POLICY "leave_requests_select" ON leave_requests FOR SELECT USING (true);

DROP POLICY IF EXISTS "leave_requests_insert" ON leave_requests;
CREATE POLICY "leave_requests_insert" ON leave_requests FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "leave_requests_update" ON leave_requests;
CREATE POLICY "leave_requests_update" ON leave_requests FOR UPDATE USING (true);

DROP POLICY IF EXISTS "leave_requests_delete" ON leave_requests;
CREATE POLICY "leave_requests_delete" ON leave_requests FOR DELETE USING (true);

-- ============================================
-- 4. 有給申請承認時に残日数を自動更新するトリガー
-- ============================================
CREATE OR REPLACE FUNCTION update_paid_leave_balance_on_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- 承認された場合のみ処理
  IF NEW.status = 'approved' AND OLD.status = 'pending' AND NEW.request_type IN ('paid_leave', 'half_day_am', 'half_day_pm') THEN
    -- 現在の年度を取得
    DECLARE
      current_fiscal_year INTEGER := EXTRACT(YEAR FROM NEW.start_date)::INTEGER;
    BEGIN
      -- 残日数を更新
      UPDATE paid_leave_balances
      SET used_days = used_days + NEW.days_count,
          updated_at = NOW()
      WHERE user_id = NEW.user_id
        AND facility_id = NEW.facility_id
        AND fiscal_year = current_fiscal_year;
    END;
  END IF;

  -- キャンセルまたは却下で承認済みだった場合、戻す
  IF (NEW.status = 'cancelled' OR NEW.status = 'rejected') AND OLD.status = 'approved' AND OLD.request_type IN ('paid_leave', 'half_day_am', 'half_day_pm') THEN
    DECLARE
      current_fiscal_year INTEGER := EXTRACT(YEAR FROM OLD.start_date)::INTEGER;
    BEGIN
      UPDATE paid_leave_balances
      SET used_days = GREATEST(0, used_days - OLD.days_count),
          updated_at = NOW()
      WHERE user_id = OLD.user_id
        AND facility_id = OLD.facility_id
        AND fiscal_year = current_fiscal_year;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_paid_leave_balance ON leave_requests;
CREATE TRIGGER trigger_update_paid_leave_balance
  AFTER UPDATE ON leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_paid_leave_balance_on_approval();
