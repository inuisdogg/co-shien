-- ============================================
-- usersテーブルのgenderカラム制約修正
-- ============================================
-- 既存の制約を削除して、正しい制約を設定します
-- SupabaseのSQL Editorで実行してください
-- ============================================

-- 1. 既存のgenderカラムの制約を確認して削除
DO $$ 
DECLARE
  constraint_name TEXT;
BEGIN
  -- users_gender_check制約を探して削除
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'users'::regclass
    AND conname LIKE '%gender%check%';
  
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE users DROP CONSTRAINT IF EXISTS %I', constraint_name);
    RAISE NOTICE '制約 % を削除しました', constraint_name;
  ELSE
    RAISE NOTICE 'gender関連の制約は見つかりませんでした';
  END IF;
END $$;

-- 2. genderカラムが存在しない場合は追加、存在する場合は制約を追加
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'gender') THEN
    -- カラムが存在しない場合は追加
    ALTER TABLE users ADD COLUMN gender TEXT;
    RAISE NOTICE 'genderカラムを追加しました';
  ELSE
    RAISE NOTICE 'genderカラムは既に存在します';
  END IF;
  
  -- 正しい制約を追加（既存の制約は上記で削除済み）
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_gender_check;
  ALTER TABLE users ADD CONSTRAINT users_gender_check 
    CHECK (gender IS NULL OR gender IN ('男性', '女性', 'その他'));
  RAISE NOTICE 'genderカラムに正しい制約を設定しました';
END $$;

-- 3. 他の必要なカラムも確認・追加
-- birth_date
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'birth_date') THEN
    ALTER TABLE users ADD COLUMN birth_date DATE;
    RAISE NOTICE 'birth_dateカラムを追加しました';
  ELSE
    RAISE NOTICE 'birth_dateカラムは既に存在します';
  END IF;
END $$;

-- address
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'address') THEN
    ALTER TABLE users ADD COLUMN address TEXT;
    RAISE NOTICE 'addressカラムを追加しました';
  ELSE
    RAISE NOTICE 'addressカラムは既に存在します';
  END IF;
END $$;

-- phone
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'phone') THEN
    ALTER TABLE users ADD COLUMN phone TEXT;
    RAISE NOTICE 'phoneカラムを追加しました';
  ELSE
    RAISE NOTICE 'phoneカラムは既に存在します';
  END IF;
END $$;

-- ============================================
-- 完了メッセージ
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'usersテーブルのgenderカラム制約修正が完了しました！';
  RAISE NOTICE 'genderカラムは以下の値を受け付けます:';
  RAISE NOTICE '  - NULL (未設定)';
  RAISE NOTICE '  - 男性';
  RAISE NOTICE '  - 女性';
  RAISE NOTICE '  - その他';
END $$;


