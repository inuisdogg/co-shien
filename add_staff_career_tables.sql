-- ============================================
-- スタッフキャリア管理テーブル作成
-- ============================================
-- 今回追加した機能（勤怠管理、有給申請、キャリア情報）のためのテーブル
-- SupabaseのSQL Editorで実行してください
-- ============================================

-- ============================================
-- 1. 勤怠記録テーブル
-- ============================================
-- 注意: user_idはauth.users(id)またはpublic.users(id)を参照します
-- 実際のテーブル構造に合わせて調整してください
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL, -- UUIDまたはTEXT（実際のusersテーブルの型に合わせて調整）
  facility_id TEXT NOT NULL,
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('start', 'end', 'break_start', 'break_end', 'manual')),
  -- 打刻の場合
  time TIME,
  -- 手動登録の場合
  start_time TIME,
  end_time TIME,
  break_start_time TIME,
  break_end_time TIME,
  reason TEXT, -- 手動登録の理由
  -- メタデータ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 複合ユニーク制約（type='manual'の場合は1日1レコードのみ）
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_records_unique_manual 
  ON attendance_records(user_id, facility_id, date) 
  WHERE type = 'manual';

-- 打刻レコードのユニーク制約
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_records_unique_punch 
  ON attendance_records(user_id, facility_id, date, type) 
  WHERE type IN ('start', 'end', 'break_start', 'break_end');

-- ============================================
-- 2. 有給申請テーブル
-- ============================================
CREATE TABLE IF NOT EXISTS paid_leave_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL, -- UUIDまたはTEXT（実際のusersテーブルの型に合わせて調整）
  facility_id TEXT NOT NULL,
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('paid_leave', 'half_paid_leave', 'special_leave')),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by TEXT, -- UUIDまたはTEXT（実際のusersテーブルの型に合わせて調整）
  approved_at TIMESTAMPTZ,
  -- メタデータ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, facility_id, date)
);

-- ============================================
-- 3. 学歴テーブル
-- ============================================
CREATE TABLE IF NOT EXISTS education_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL, -- UUIDまたはTEXT（実際のusersテーブルの型に合わせて調整）
  school_name TEXT NOT NULL,
  graduation_date DATE,
  degree TEXT,
  -- メタデータ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. 資格テーブル
-- ============================================
CREATE TABLE IF NOT EXISTS qualifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL, -- UUIDまたはTEXT（実際のusersテーブルの型に合わせて調整）
  name TEXT NOT NULL,
  image_url TEXT, -- 資格証の画像URL
  status TEXT NOT NULL DEFAULT 'not_registered' CHECK (status IN ('not_registered', 'pending', 'approved')),
  approved_by TEXT, -- UUIDまたはTEXT（実際のusersテーブルの型に合わせて調整）
  approved_at TIMESTAMPTZ,
  -- メタデータ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. 職歴（実務経験証明書）テーブル
-- ============================================
CREATE TABLE IF NOT EXISTS experience_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL, -- UUIDまたはTEXT（実際のusersテーブルの型に合わせて調整）
  facility_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE, -- NULLの場合は在籍中
  certificate_status TEXT NOT NULL DEFAULT 'not_requested' CHECK (certificate_status IN ('not_requested', 'pending', 'approved')),
  pdf_url TEXT, -- 実務経験証明書のPDF URL
  requested_at TIMESTAMPTZ,
  approved_by TEXT, -- UUIDまたはTEXT（実際のusersテーブルの型に合わせて調整）
  approved_at TIMESTAMPTZ,
  -- メタデータ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. usersテーブルの拡張（既存のusersテーブルにカラムを追加）
-- ============================================
-- 注意: 既存のusersテーブルにカラムが存在する場合はスキップされます

-- メールアドレス（ログインID）
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'email') THEN
    ALTER TABLE users ADD COLUMN email TEXT;
  END IF;
END $$;

-- 基礎年金番号
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'basic_pension_symbol') THEN
    ALTER TABLE users ADD COLUMN basic_pension_symbol TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'basic_pension_number') THEN
    ALTER TABLE users ADD COLUMN basic_pension_number TEXT;
  END IF;
END $$;

-- 雇用保険
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'employment_insurance_status') THEN
    ALTER TABLE users ADD COLUMN employment_insurance_status TEXT CHECK (employment_insurance_status IN ('joined', 'not_joined', 'first_time'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'employment_insurance_number') THEN
    ALTER TABLE users ADD COLUMN employment_insurance_number TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'previous_retirement_date') THEN
    ALTER TABLE users ADD COLUMN previous_retirement_date DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'previous_name') THEN
    ALTER TABLE users ADD COLUMN previous_name TEXT;
  END IF;
END $$;

-- 社会保険
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'social_insurance_status') THEN
    ALTER TABLE users ADD COLUMN social_insurance_status TEXT CHECK (social_insurance_status IN ('joined', 'not_joined'));
  END IF;
END $$;

-- 扶養家族
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'has_dependents') THEN
    ALTER TABLE users ADD COLUMN has_dependents BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'dependent_count') THEN
    ALTER TABLE users ADD COLUMN dependent_count INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'dependents') THEN
    ALTER TABLE users ADD COLUMN dependents JSONB DEFAULT '[]'::JSONB;
  END IF;
END $$;

-- 基本プロフィール情報（学歴、配偶者、マイナンバー）
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'education') THEN
    ALTER TABLE users ADD COLUMN education TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'spouse_name') THEN
    ALTER TABLE users ADD COLUMN spouse_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'my_number') THEN
    ALTER TABLE users ADD COLUMN my_number TEXT;
  END IF;
END $$;

-- ============================================
-- インデックスの作成
-- ============================================

-- 勤怠記録
CREATE INDEX IF NOT EXISTS idx_attendance_records_user_id ON attendance_records(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_facility_id ON attendance_records(facility_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_date ON attendance_records(date);
CREATE INDEX IF NOT EXISTS idx_attendance_records_user_facility_date ON attendance_records(user_id, facility_id, date);

-- 有給申請
CREATE INDEX IF NOT EXISTS idx_paid_leave_requests_user_id ON paid_leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_paid_leave_requests_facility_id ON paid_leave_requests(facility_id);
CREATE INDEX IF NOT EXISTS idx_paid_leave_requests_date ON paid_leave_requests(date);
CREATE INDEX IF NOT EXISTS idx_paid_leave_requests_status ON paid_leave_requests(status);

-- 学歴
CREATE INDEX IF NOT EXISTS idx_education_history_user_id ON education_history(user_id);

-- 資格
CREATE INDEX IF NOT EXISTS idx_qualifications_user_id ON qualifications(user_id);
CREATE INDEX IF NOT EXISTS idx_qualifications_status ON qualifications(status);

-- 職歴
CREATE INDEX IF NOT EXISTS idx_experience_records_user_id ON experience_records(user_id);
CREATE INDEX IF NOT EXISTS idx_experience_records_certificate_status ON experience_records(certificate_status);

-- ============================================
-- 更新日時の自動更新トリガー
-- ============================================
-- 既存のトリガーを削除してから再作成

-- 勤怠記録
DROP TRIGGER IF EXISTS update_attendance_records_updated_at ON attendance_records;
CREATE TRIGGER update_attendance_records_updated_at BEFORE UPDATE ON attendance_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 有給申請
DROP TRIGGER IF EXISTS update_paid_leave_requests_updated_at ON paid_leave_requests;
CREATE TRIGGER update_paid_leave_requests_updated_at BEFORE UPDATE ON paid_leave_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 学歴
DROP TRIGGER IF EXISTS update_education_history_updated_at ON education_history;
CREATE TRIGGER update_education_history_updated_at BEFORE UPDATE ON education_history
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 資格
DROP TRIGGER IF EXISTS update_qualifications_updated_at ON qualifications;
CREATE TRIGGER update_qualifications_updated_at BEFORE UPDATE ON qualifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 職歴
DROP TRIGGER IF EXISTS update_experience_records_updated_at ON experience_records;
CREATE TRIGGER update_experience_records_updated_at BEFORE UPDATE ON experience_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 完了メッセージ
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'スタッフキャリア管理テーブルの作成が完了しました！';
  RAISE NOTICE '作成されたテーブル:';
  RAISE NOTICE '  - attendance_records (勤怠記録)';
  RAISE NOTICE '  - paid_leave_requests (有給申請)';
  RAISE NOTICE '  - education_history (学歴)';
  RAISE NOTICE '  - qualifications (資格)';
  RAISE NOTICE '  - experience_records (職歴)';
  RAISE NOTICE '拡張されたテーブル:';
  RAISE NOTICE '  - users (メールアドレス、基礎年金番号、雇用保険、社会保険、扶養家族)';
END $$;

