-- ============================================
-- 初期スキーマ: 基本テーブル作成
-- ============================================
-- users、facilities、その他の基本テーブルを作成

-- ============================================
-- 1. facilitiesテーブル
-- ============================================
CREATE TABLE IF NOT EXISTS facilities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. usersテーブル（個人アカウント）
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT,
  name TEXT,
  login_id TEXT,
  password_hash TEXT,
  role TEXT DEFAULT 'staff' CHECK (role IN ('admin', 'manager', 'staff')),
  facility_id TEXT, -- 後方互換性のため保持（将来的に削除予定）
  permissions JSONB DEFAULT '{}'::JSONB,
  account_status TEXT DEFAULT 'pending' CHECK (account_status IN ('pending', 'active', 'suspended')),
  has_account BOOLEAN DEFAULT false,
  invited_by_facility_id TEXT,
  invited_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. staffテーブル（後方互換性のため保持）
-- ============================================
CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL,
  user_id TEXT,
  name TEXT NOT NULL,
  name_kana TEXT,
  role TEXT NOT NULL CHECK (role IN ('一般スタッフ', 'マネージャー', '管理者')),
  type TEXT NOT NULL CHECK (type IN ('常勤', '非常勤')),
  birth_date DATE,
  gender TEXT CHECK (gender IN ('男性', '女性', 'その他')),
  address TEXT,
  phone TEXT,
  email TEXT,
  has_account BOOLEAN DEFAULT false,
  login_id TEXT,
  password_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. employment_recordsテーブル
-- ============================================
CREATE TABLE IF NOT EXISTS employment_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE,
  role TEXT NOT NULL CHECK (role IN ('一般スタッフ', 'マネージャー', '管理者')),
  employment_type TEXT NOT NULL CHECK (employment_type IN ('常勤', '非常勤')),
  permissions JSONB DEFAULT '{}'::JSONB,
  experience_verification_status TEXT DEFAULT 'not_requested' CHECK (experience_verification_status IN (
    'not_requested', 'requested', 'approved', 'rejected', 'expired'
  )),
  experience_verification_requested_at TIMESTAMPTZ,
  experience_verification_approved_at TIMESTAMPTZ,
  experience_verification_approved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, facility_id)
);

-- ============================================
-- 5. user_careersテーブル
-- ============================================
CREATE TABLE IF NOT EXISTS user_careers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  qualification_name TEXT,
  certificate_url TEXT,
  work_history JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. childrenテーブル
-- ============================================
CREATE TABLE IF NOT EXISTS children (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL,
  name TEXT NOT NULL,
  name_kana TEXT,
  age INTEGER,
  birth_date DATE,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  guardian_name TEXT,
  guardian_name_kana TEXT,
  guardian_relationship TEXT,
  beneficiary_number TEXT,
  grant_days INTEGER,
  contract_days INTEGER,
  address TEXT,
  phone TEXT,
  email TEXT,
  doctor_name TEXT,
  doctor_clinic TEXT,
  school_name TEXT,
  pattern TEXT,
  pattern_days JSONB,
  needs_pickup BOOLEAN DEFAULT false,
  needs_dropoff BOOLEAN DEFAULT false,
  pickup_location TEXT,
  pickup_location_custom TEXT,
  dropoff_location TEXT,
  dropoff_location_custom TEXT,
  characteristics TEXT,
  contract_status TEXT NOT NULL CHECK (contract_status IN ('pre-contract', 'active', 'inactive', 'terminated')),
  contract_start_date DATE,
  contract_end_date DATE,
  enrollment_date DATE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. leadsテーブル
-- ============================================
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL,
  name TEXT NOT NULL,
  child_name TEXT,
  status TEXT NOT NULL CHECK (status IN ('new-inquiry', 'visit-scheduled', 'considering', 'waiting-benefit', 'contract-progress', 'contracted', 'lost')),
  phone TEXT,
  email TEXT,
  address TEXT,
  expected_start_date DATE,
  preferred_days TEXT[] DEFAULT ARRAY[]::TEXT[],
  pickup_option TEXT CHECK (pickup_option IN ('required', 'preferred', 'not-needed')),
  inquiry_source TEXT CHECK (inquiry_source IN ('devnavi', 'homepage', 'support-office', 'other')),
  inquiry_source_detail TEXT,
  child_ids TEXT[] DEFAULT ARRAY[]::TEXT[],
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 8. facility_settingsテーブル
-- ============================================
CREATE TABLE IF NOT EXISTS facility_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  facility_id TEXT NOT NULL,
  facility_name TEXT,
  regular_holidays INTEGER[] DEFAULT ARRAY[0],
  custom_holidays TEXT[] DEFAULT ARRAY[]::TEXT[],
  business_hours JSONB NOT NULL DEFAULT '{"AM": {"start": "09:00", "end": "12:00"}, "PM": {"start": "13:00", "end": "18:00"}}',
  capacity JSONB NOT NULL DEFAULT '{"AM": 10, "PM": 10}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(facility_id)
);

-- ============================================
-- 9. companiesテーブル
-- ============================================
CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 10. otp_codesテーブル
-- ============================================
CREATE TABLE IF NOT EXISTS otp_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_login_id ON users(login_id);
CREATE INDEX IF NOT EXISTS idx_staff_facility_id ON staff(facility_id);
CREATE INDEX IF NOT EXISTS idx_staff_user_id ON staff(user_id);
CREATE INDEX IF NOT EXISTS idx_employment_records_user_id ON employment_records(user_id);
CREATE INDEX IF NOT EXISTS idx_employment_records_facility_id ON employment_records(facility_id);
CREATE INDEX IF NOT EXISTS idx_children_facility_id ON children(facility_id);
CREATE INDEX IF NOT EXISTS idx_leads_facility_id ON leads(facility_id);
CREATE INDEX IF NOT EXISTS idx_facility_settings_facility_id ON facility_settings(facility_id);
CREATE INDEX IF NOT EXISTS idx_otp_codes_email ON otp_codes(email);
CREATE INDEX IF NOT EXISTS idx_otp_codes_code ON otp_codes(code);

