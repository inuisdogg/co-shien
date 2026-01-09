-- ============================================
-- usersテーブルに不足しているカラムを追加（本番環境との整合性確保）
-- ============================================

-- phoneカラム
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS phone TEXT;

-- invitation関連カラム
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS invitation_start_date DATE;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS invitation_role TEXT;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS invitation_employment_type TEXT;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS invitation_permissions JSONB DEFAULT '{}'::JSONB;

-- 住所関連カラム
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS postal_code TEXT;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS address TEXT;

-- 個人情報関連カラム
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS my_number TEXT;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS spouse_name TEXT;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS spouse_birth_date DATE;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS has_spouse BOOLEAN DEFAULT false;

-- 年金関連カラム
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS basic_pension_symbol TEXT;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS basic_pension_number TEXT;

-- 雇用保険関連カラム
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS employment_insurance_status TEXT;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS employment_insurance_number TEXT;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS previous_retirement_date DATE;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS previous_name TEXT;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS social_insurance_status TEXT;

-- 扶養関連カラム
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS has_dependents BOOLEAN DEFAULT false;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS dependent_count INTEGER DEFAULT 0;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS dependents JSONB DEFAULT '[]'::JSONB;

-- その他
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS education TEXT;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS draft_data JSONB;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS wants_part_time_work BOOLEAN DEFAULT false;

