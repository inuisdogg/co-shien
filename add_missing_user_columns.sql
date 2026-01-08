-- ============================================
-- usersテーブルに不足しているカラムを追加
-- ============================================
-- 基本プロフィール保存時に必要なカラムを追加します
-- SupabaseのSQL Editorで実行してください
-- ============================================

-- 基本プロフィール情報（学歴、配偶者、マイナンバー）
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'education') THEN
    ALTER TABLE users ADD COLUMN education TEXT;
    RAISE NOTICE 'educationカラムを追加しました';
  ELSE
    RAISE NOTICE 'educationカラムは既に存在します';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'spouse_name') THEN
    ALTER TABLE users ADD COLUMN spouse_name TEXT;
    RAISE NOTICE 'spouse_nameカラムを追加しました';
  ELSE
    RAISE NOTICE 'spouse_nameカラムは既に存在します';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'my_number') THEN
    ALTER TABLE users ADD COLUMN my_number TEXT;
    RAISE NOTICE 'my_numberカラムを追加しました';
  ELSE
    RAISE NOTICE 'my_numberカラムは既に存在します';
  END IF;
END $$;

-- メールアドレス（ログインID）
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'email') THEN
    ALTER TABLE users ADD COLUMN email TEXT;
    RAISE NOTICE 'emailカラムを追加しました';
  ELSE
    RAISE NOTICE 'emailカラムは既に存在します';
  END IF;
END $$;

-- 基礎年金番号
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'basic_pension_symbol') THEN
    ALTER TABLE users ADD COLUMN basic_pension_symbol TEXT;
    RAISE NOTICE 'basic_pension_symbolカラムを追加しました';
  ELSE
    RAISE NOTICE 'basic_pension_symbolカラムは既に存在します';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'basic_pension_number') THEN
    ALTER TABLE users ADD COLUMN basic_pension_number TEXT;
    RAISE NOTICE 'basic_pension_numberカラムを追加しました';
  ELSE
    RAISE NOTICE 'basic_pension_numberカラムは既に存在します';
  END IF;
END $$;

-- 雇用保険
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'employment_insurance_status') THEN
    ALTER TABLE users ADD COLUMN employment_insurance_status TEXT CHECK (employment_insurance_status IN ('joined', 'not_joined', 'first_time'));
    RAISE NOTICE 'employment_insurance_statusカラムを追加しました';
  ELSE
    RAISE NOTICE 'employment_insurance_statusカラムは既に存在します';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'employment_insurance_number') THEN
    ALTER TABLE users ADD COLUMN employment_insurance_number TEXT;
    RAISE NOTICE 'employment_insurance_numberカラムを追加しました';
  ELSE
    RAISE NOTICE 'employment_insurance_numberカラムは既に存在します';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'previous_retirement_date') THEN
    ALTER TABLE users ADD COLUMN previous_retirement_date DATE;
    RAISE NOTICE 'previous_retirement_dateカラムを追加しました';
  ELSE
    RAISE NOTICE 'previous_retirement_dateカラムは既に存在します';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'previous_name') THEN
    ALTER TABLE users ADD COLUMN previous_name TEXT;
    RAISE NOTICE 'previous_nameカラムを追加しました';
  ELSE
    RAISE NOTICE 'previous_nameカラムは既に存在します';
  END IF;
END $$;

-- 社会保険
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'social_insurance_status') THEN
    ALTER TABLE users ADD COLUMN social_insurance_status TEXT CHECK (social_insurance_status IN ('joined', 'not_joined'));
    RAISE NOTICE 'social_insurance_statusカラムを追加しました';
  ELSE
    RAISE NOTICE 'social_insurance_statusカラムは既に存在します';
  END IF;
END $$;

-- 扶養家族
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'has_dependents') THEN
    ALTER TABLE users ADD COLUMN has_dependents BOOLEAN DEFAULT false;
    RAISE NOTICE 'has_dependentsカラムを追加しました';
  ELSE
    RAISE NOTICE 'has_dependentsカラムは既に存在します';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'dependent_count') THEN
    ALTER TABLE users ADD COLUMN dependent_count INTEGER DEFAULT 0;
    RAISE NOTICE 'dependent_countカラムを追加しました';
  ELSE
    RAISE NOTICE 'dependent_countカラムは既に存在します';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'dependents') THEN
    ALTER TABLE users ADD COLUMN dependents JSONB DEFAULT '[]'::JSONB;
    RAISE NOTICE 'dependentsカラムを追加しました';
  ELSE
    RAISE NOTICE 'dependentsカラムは既に存在します';
  END IF;
END $$;

-- ============================================
-- 完了メッセージ
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'usersテーブルの不足カラム追加が完了しました！';
  RAISE NOTICE '追加されたカラム:';
  RAISE NOTICE '  - education (学歴)';
  RAISE NOTICE '  - spouse_name (配偶者氏名)';
  RAISE NOTICE '  - my_number (マイナンバー)';
  RAISE NOTICE '  - email (メールアドレス)';
  RAISE NOTICE '  - basic_pension_symbol, basic_pension_number (基礎年金番号)';
  RAISE NOTICE '  - employment_insurance_* (雇用保険関連)';
  RAISE NOTICE '  - social_insurance_status (社会保険)';
  RAISE NOTICE '  - has_dependents, dependent_count, dependents (扶養家族)';
END $$;





