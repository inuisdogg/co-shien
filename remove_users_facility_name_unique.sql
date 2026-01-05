-- ============================================
-- usersテーブルの(facility_id, name)ユニーク制約を削除
-- ============================================
-- キャリアプラットフォームでは、ユーザーは複数の施設に所属可能
-- また、名前の変更時に制約違反が発生しないようにするため
-- SupabaseのSQL Editorで実行してください
-- ============================================

-- 1. 既存のユニーク制約を確認して削除
DO $$ 
DECLARE
  constraint_name TEXT;
BEGIN
  -- users_facility_id_name_key制約を探して削除
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'users'::regclass
    AND contype = 'u'  -- unique constraint
    AND (conname LIKE '%facility%name%' OR conname LIKE '%name%facility%');
  
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE users DROP CONSTRAINT IF EXISTS %I', constraint_name);
    RAISE NOTICE 'ユニーク制約 % を削除しました', constraint_name;
  ELSE
    -- 別の方法で探す
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'users'::regclass
      AND contype = 'u';
    
    IF constraint_name IS NOT NULL THEN
      -- 制約の定義を確認
      RAISE NOTICE '見つかったユニーク制約: %', constraint_name;
      RAISE NOTICE '制約定義: %', pg_get_constraintdef((SELECT oid FROM pg_constraint WHERE conname = constraint_name));
    ELSE
      RAISE NOTICE 'ユニーク制約は見つかりませんでした';
    END IF;
  END IF;
END $$;

-- 2. 明示的に制約名を指定して削除（念のため）
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_facility_id_name_key;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_facility_name_key;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_name_facility_key;

-- 3. 確認: 残っているユニーク制約を表示
DO $$
DECLARE
  r RECORD;
BEGIN
  RAISE NOTICE '=== usersテーブルのユニーク制約一覧 ===';
  FOR r IN 
    SELECT 
      conname as constraint_name,
      pg_get_constraintdef(oid) as constraint_definition
    FROM pg_constraint
    WHERE conrelid = 'users'::regclass
      AND contype = 'u'
  LOOP
    RAISE NOTICE '制約名: %, 定義: %', r.constraint_name, r.constraint_definition;
  END LOOP;
END $$;

-- ============================================
-- 完了メッセージ
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'usersテーブルの(facility_id, name)ユニーク制約の削除が完了しました！';
  RAISE NOTICE 'これにより、同じ施設内で同じ名前のユーザーが複数存在できるようになりました。';
  RAISE NOTICE 'また、名前の変更時にも制約違反が発生しなくなります。';
END $$;



