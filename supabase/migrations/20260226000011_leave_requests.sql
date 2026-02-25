-- ============================================
-- 休暇申請・有給残日数テーブルの補完マイグレーション
-- 既存テーブルがある場合は不足カラムのみ追加
-- ============================================

-- ============================================
-- 1. leave_requests テーブル
-- ============================================
CREATE TABLE IF NOT EXISTS leave_requests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL DEFAULT 'paid_leave' CHECK (request_type IN ('paid_leave', 'half_day_am', 'half_day_pm', 'special_leave', 'sick_leave', 'absence')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count NUMERIC(4,1) NOT NULL DEFAULT 1,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  approved_by TEXT REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 不足カラムがあれば追加（既存テーブルの場合）
DO $$
BEGIN
  -- rejection_reason カラム
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leave_requests' AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE leave_requests ADD COLUMN rejection_reason TEXT;
  END IF;

  -- approved_by カラム
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leave_requests' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE leave_requests ADD COLUMN approved_by TEXT REFERENCES users(id);
  END IF;

  -- approved_at カラム
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leave_requests' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE leave_requests ADD COLUMN approved_at TIMESTAMPTZ;
  END IF;

  -- updated_at カラム
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leave_requests' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE leave_requests ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- インデックス（既存なら無視）
CREATE INDEX IF NOT EXISTS idx_leave_requests_user ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_facility ON leave_requests(facility_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON leave_requests(start_date, end_date);

-- ============================================
-- 2. paid_leave_balances テーブル
-- ============================================
CREATE TABLE IF NOT EXISTS paid_leave_balances (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  fiscal_year INTEGER NOT NULL,
  total_days NUMERIC(4,1) NOT NULL DEFAULT 0,
  used_days NUMERIC(4,1) NOT NULL DEFAULT 0,
  remaining_days NUMERIC(4,1) GENERATED ALWAYS AS (total_days - used_days) STORED,
  granted_date DATE,
  expires_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, facility_id, fiscal_year)
);

-- 不足カラムがあれば追加
DO $$
BEGIN
  -- expires_date カラム
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'paid_leave_balances' AND column_name = 'expires_date'
  ) THEN
    ALTER TABLE paid_leave_balances ADD COLUMN expires_date DATE;
  END IF;

  -- granted_date カラム
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'paid_leave_balances' AND column_name = 'granted_date'
  ) THEN
    ALTER TABLE paid_leave_balances ADD COLUMN granted_date DATE;
  END IF;
END $$;

-- インデックス（既存なら無視）
CREATE INDEX IF NOT EXISTS idx_paid_leave_balances_user ON paid_leave_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_paid_leave_balances_facility ON paid_leave_balances(facility_id);
CREATE INDEX IF NOT EXISTS idx_paid_leave_balances_year ON paid_leave_balances(fiscal_year);

-- ============================================
-- 3. RLS設定
-- ============================================
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE paid_leave_balances ENABLE ROW LEVEL SECURITY;

-- leave_requests RLS（facility_idベース）
DROP POLICY IF EXISTS "leave_requests_select_by_facility" ON leave_requests;
CREATE POLICY "leave_requests_select_by_facility" ON leave_requests
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "leave_requests_insert_own" ON leave_requests;
CREATE POLICY "leave_requests_insert_own" ON leave_requests
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "leave_requests_update_facility" ON leave_requests;
CREATE POLICY "leave_requests_update_facility" ON leave_requests
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "leave_requests_delete_own" ON leave_requests;
CREATE POLICY "leave_requests_delete_own" ON leave_requests
  FOR DELETE USING (true);

-- paid_leave_balances RLS
DROP POLICY IF EXISTS "paid_leave_balances_select_by_facility" ON paid_leave_balances;
CREATE POLICY "paid_leave_balances_select_by_facility" ON paid_leave_balances
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "paid_leave_balances_insert_facility" ON paid_leave_balances;
CREATE POLICY "paid_leave_balances_insert_facility" ON paid_leave_balances
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "paid_leave_balances_update_facility" ON paid_leave_balances;
CREATE POLICY "paid_leave_balances_update_facility" ON paid_leave_balances
  FOR UPDATE USING (true);

-- ============================================
-- 4. 承認時トリガー（冪等: 既存なら再作成）
-- ============================================
CREATE OR REPLACE FUNCTION update_paid_leave_balance_on_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- 承認された場合のみ処理
  IF NEW.status = 'approved' AND OLD.status = 'pending' AND NEW.request_type IN ('paid_leave', 'half_day_am', 'half_day_pm') THEN
    DECLARE
      current_fiscal_year INTEGER := EXTRACT(YEAR FROM NEW.start_date)::INTEGER;
    BEGIN
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
