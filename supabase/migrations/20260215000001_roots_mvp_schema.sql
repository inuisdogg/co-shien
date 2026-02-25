-- ============================================
-- Roots MVP スキーマ
-- サービス名: Roots (旧co-shien)
-- ============================================

-- ============================================
-- 1. usersテーブルの調整
-- role: admin(施設管理者) / staff(スタッフ) / parent(保護者)
-- ============================================
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'manager', 'staff', 'parent'));

-- user_typeカラムが存在しない場合は追加
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'user_type') THEN
    ALTER TABLE users ADD COLUMN user_type TEXT DEFAULT 'staff';
  END IF;
END $$;

-- ============================================
-- 2. staff_profiles テーブル（資格・経歴）
-- スタッフのキャリア情報を蓄積
-- ============================================
CREATE TABLE IF NOT EXISTS staff_profiles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  qualifications JSONB DEFAULT '[]'::JSONB,
  -- qualifications: [{name: "保育士", obtained_date: "2020-04-01", certificate_url: "..."}]
  work_history JSONB DEFAULT '[]'::JSONB,
  -- work_history: [{facility_name: "〇〇園", role: "保育士", start_date: "2020-04", end_date: "2023-03"}]
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_profiles_user_id ON staff_profiles(user_id);

-- ============================================
-- 3. facility_children テーブル（施設-児童 N:M中間テーブル）
-- 1人の児童が複数施設に通えるようにする
-- ============================================
CREATE TABLE IF NOT EXISTS facility_children (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  contract_status TEXT NOT NULL DEFAULT 'pre-contract'
    CHECK (contract_status IN ('pre-contract', 'active', 'inactive', 'terminated')),
  beneficiary_number TEXT,
  beneficiary_image_url TEXT,
  beneficiary_valid_from DATE,
  beneficiary_valid_to DATE,
  grant_days INTEGER,
  contract_start_date DATE,
  contract_end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(facility_id, child_id)
);

CREATE INDEX IF NOT EXISTS idx_facility_children_facility_id ON facility_children(facility_id);
CREATE INDEX IF NOT EXISTS idx_facility_children_child_id ON facility_children(child_id);

-- ============================================
-- 4. childrenテーブルの調整
-- parent_user_id（保護者）に紐づける
-- ============================================
DO $$
BEGIN
  -- parent_user_idカラムを追加（存在しない場合）
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'children' AND column_name = 'parent_user_id') THEN
    ALTER TABLE children ADD COLUMN parent_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  -- medical_infoカラムを追加（存在しない場合）
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'children' AND column_name = 'medical_info') THEN
    ALTER TABLE children ADD COLUMN medical_info JSONB DEFAULT '{}'::JSONB;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_children_parent_user_id ON children(parent_user_id);

-- ============================================
-- 5. attendances テーブル（勤怠打刻）
-- ★施設の監査データ & スタッフの実務経験ログ
-- ============================================
CREATE TABLE IF NOT EXISTS attendances (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  clock_in_method TEXT CHECK (clock_in_method IN ('gps', 'qr', 'manual')),
  clock_out_method TEXT CHECK (clock_out_method IN ('gps', 'qr', 'manual')),
  clock_in_location JSONB,
  -- {lat: 35.6812, lng: 139.7671, accuracy: 10}
  clock_out_location JSONB,
  break_minutes INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'modified', 'rejected')),
  modified_by TEXT REFERENCES users(id),
  modified_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, facility_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendances_user_id ON attendances(user_id);
CREATE INDEX IF NOT EXISTS idx_attendances_facility_id ON attendances(facility_id);
CREATE INDEX IF NOT EXISTS idx_attendances_date ON attendances(date);
CREATE INDEX IF NOT EXISTS idx_attendances_user_facility_date ON attendances(user_id, facility_id, date);

-- ============================================
-- 6. shifts テーブル（シフト）
-- ============================================
DROP TABLE IF EXISTS shifts CASCADE;

CREATE TABLE shifts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_minutes INTEGER DEFAULT 60,
  shift_type TEXT DEFAULT 'normal' CHECK (shift_type IN ('normal', 'early', 'late', 'night', 'holiday')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'confirmed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, facility_id, date)
);

CREATE INDEX IF NOT EXISTS idx_shifts_user_id ON shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_shifts_facility_id ON shifts(facility_id);
CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date);

-- ============================================
-- 7. leave_requests テーブル（有給休暇申請）
-- ============================================
CREATE TABLE IF NOT EXISTS leave_requests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL DEFAULT 'paid' CHECK (leave_type IN ('paid', 'sick', 'special', 'other')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  approved_by TEXT REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_user_id ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_facility_id ON leave_requests(facility_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);

-- ============================================
-- 8. daily_records テーブル（日々の記録・連絡）
-- 施設と保護者のコミュニケーション
-- ============================================
CREATE TABLE IF NOT EXISTS daily_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  record_type TEXT NOT NULL DEFAULT 'activity' CHECK (record_type IN ('activity', 'absence', 'notice')),
  content TEXT,
  absence_reason TEXT,
  images JSONB DEFAULT '[]'::JSONB,
  -- [{url: "...", caption: "..."}]
  created_by TEXT REFERENCES users(id),
  read_at TIMESTAMPTZ,
  -- 保護者が読んだ日時
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_records_facility_id ON daily_records(facility_id);
CREATE INDEX IF NOT EXISTS idx_daily_records_child_id ON daily_records(child_id);
CREATE INDEX IF NOT EXISTS idx_daily_records_date ON daily_records(date);

-- ============================================
-- 9. RLS (Row Level Security) ポリシー
-- ============================================

-- attendances
ALTER TABLE attendances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendances_select_policy" ON attendances;
CREATE POLICY "attendances_select_policy" ON attendances
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "attendances_insert_policy" ON attendances;
CREATE POLICY "attendances_insert_policy" ON attendances
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "attendances_update_policy" ON attendances;
CREATE POLICY "attendances_update_policy" ON attendances
  FOR UPDATE USING (true);

-- shifts
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shifts_select_policy" ON shifts;
CREATE POLICY "shifts_select_policy" ON shifts
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "shifts_all_policy" ON shifts;
CREATE POLICY "shifts_all_policy" ON shifts
  FOR ALL USING (true);

-- leave_requests
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leave_requests_select_policy" ON leave_requests;
CREATE POLICY "leave_requests_select_policy" ON leave_requests
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "leave_requests_all_policy" ON leave_requests;
CREATE POLICY "leave_requests_all_policy" ON leave_requests
  FOR ALL USING (true);

-- daily_records
ALTER TABLE daily_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_records_select_policy" ON daily_records;
CREATE POLICY "daily_records_select_policy" ON daily_records
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "daily_records_all_policy" ON daily_records;
CREATE POLICY "daily_records_all_policy" ON daily_records
  FOR ALL USING (true);

-- staff_profiles
ALTER TABLE staff_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_profiles_select_policy" ON staff_profiles;
CREATE POLICY "staff_profiles_select_policy" ON staff_profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "staff_profiles_all_policy" ON staff_profiles;
CREATE POLICY "staff_profiles_all_policy" ON staff_profiles
  FOR ALL USING (true);

-- facility_children
ALTER TABLE facility_children ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "facility_children_select_policy" ON facility_children;
CREATE POLICY "facility_children_select_policy" ON facility_children
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "facility_children_all_policy" ON facility_children;
CREATE POLICY "facility_children_all_policy" ON facility_children
  FOR ALL USING (true);

-- ============================================
-- 10. 既存データのマイグレーション
-- childrenテーブルのデータをfacility_childrenに移行
-- ============================================
INSERT INTO facility_children (facility_id, child_id, contract_status, beneficiary_number, grant_days, contract_start_date, contract_end_date)
SELECT
  facility_id,
  id,
  contract_status,
  beneficiary_number,
  grant_days,
  contract_start_date,
  contract_end_date
FROM children
WHERE facility_id IS NOT NULL
ON CONFLICT (facility_id, child_id) DO NOTHING;

-- ============================================
-- 完了
-- ============================================
