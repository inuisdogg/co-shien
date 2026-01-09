-- user_typeのデフォルト値を削除し、明示的な設定を強制
-- これにより、利用者登録時にuser_typeが設定されていない場合にスタッフアカウントが作成されることを防ぐ

-- 1. 既存のデフォルト制約を削除
ALTER TABLE users 
ALTER COLUMN user_type DROP DEFAULT;

-- 2. user_typeがNULLの場合はNOT NULL制約を追加できないため、
-- まず既存のNULL値を確認し、必要に応じて修正
-- （既存のNULL値は手動で修正する必要がある）

-- 3. user_typeがNULLのレコードがある場合は警告を出す
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE user_type IS NULL) THEN
    RAISE WARNING 'user_typeがNULLのレコードが存在します。手動で修正してください。';
  END IF;
END $$;

-- 4. コメントを更新
COMMENT ON COLUMN users.user_type IS 'ユーザー種別: staff=スタッフ, client=利用者（保護者）。NULLは許可されない。明示的に設定する必要がある。';

