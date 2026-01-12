-- 履歴書・職務経歴書に必要なフィールドを追加

-- 顔写真
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;

-- 通勤情報
ALTER TABLE users ADD COLUMN IF NOT EXISTS nearest_station TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS commute_time TEXT;

-- 学歴詳細（JSON配列: [{schoolName, department, startDate, endDate, graduationType}]）
ALTER TABLE users ADD COLUMN IF NOT EXISTS education_history JSONB DEFAULT '[]'::jsonb;

-- 職歴詳細（JSON配列: [{companyName, department, position, startDate, endDate, jobDescription, achievements}]）
ALTER TABLE users ADD COLUMN IF NOT EXISTS work_history JSONB DEFAULT '[]'::jsonb;

-- 免許・資格（JSON配列: [{name, acquiredDate, imageUrl}]）
ALTER TABLE users ADD COLUMN IF NOT EXISTS licenses_qualifications JSONB DEFAULT '[]'::jsonb;

-- 志望動機・本人希望
ALTER TABLE users ADD COLUMN IF NOT EXISTS motivation TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_requests TEXT;

-- 特技・趣味
ALTER TABLE users ADD COLUMN IF NOT EXISTS skills_hobbies TEXT;

-- 健康状態
ALTER TABLE users ADD COLUMN IF NOT EXISTS health_status TEXT DEFAULT '良好';

-- 職務経歴書用
ALTER TABLE users ADD COLUMN IF NOT EXISTS career_summary TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS applicable_skills TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS self_promotion TEXT;

-- 緊急連絡先
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_relationship TEXT;

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_users_profile_photo ON users(profile_photo_url) WHERE profile_photo_url IS NOT NULL;
