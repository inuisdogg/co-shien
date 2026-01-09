-- ============================================
-- staffテーブルに不足しているカラムを追加（本番環境との整合性確保）
-- ============================================

-- 資格関連カラム
ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS qualifications TEXT;

ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS years_of_experience INTEGER;

ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS qualification_certificate TEXT;

ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS experience_certificate TEXT;

-- 緊急連絡先関連カラム
ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS emergency_contact TEXT;

ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;

-- その他
ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS memo TEXT;

ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS monthly_salary NUMERIC(12, 2);

ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS hourly_wage NUMERIC(10, 2);

