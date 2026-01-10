-- 開発テストアカウントのlogin_idを設定

DO $$
DECLARE
  v_user_id TEXT;
BEGIN
  -- 開発テストユーザーを取得
  SELECT id INTO v_user_id
  FROM users
  WHERE name = '開発テスト' OR email = 'dev-test@example.com'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE '開発テストユーザーが見つかりません';
    RETURN;
  END IF;

  -- login_idを設定（メールアドレスと同じ）
  UPDATE users
  SET 
    login_id = 'dev-test@example.com',
    updated_at = NOW()
  WHERE id = v_user_id;

  RAISE NOTICE 'login_idを設定しました: dev-test@example.com';
END $$;

