-- 開発テストアカウントのログイン設定を確認・修正

DO $$
DECLARE
  v_user_id TEXT;
  v_user_data RECORD;
BEGIN
  -- 開発テストユーザーを取得
  SELECT * INTO v_user_data
  FROM users
  WHERE name = '開発テスト' OR email = 'dev-test@example.com'
  LIMIT 1;

  IF v_user_data.id IS NULL THEN
    RAISE NOTICE '開発テストユーザーが見つかりません';
    RETURN;
  END IF;

  v_user_id := v_user_data.id;

  RAISE NOTICE '=== 現在の設定 ===';
  RAISE NOTICE 'ユーザーID: %', v_user_id;
  RAISE NOTICE '名前: %', v_user_data.name;
  RAISE NOTICE 'メール: %', v_user_data.email;
  RAISE NOTICE 'user_type: %', v_user_data.user_type;
  RAISE NOTICE 'role: %', v_user_data.role;
  RAISE NOTICE 'account_status: %', v_user_data.account_status;
  RAISE NOTICE 'password_hash: %', CASE WHEN v_user_data.password_hash IS NULL THEN 'NULL' ELSE '設定済み' END;
  RAISE NOTICE 'facility_id: %', v_user_data.facility_id;

  -- ログインに必要な設定を確認・修正
  UPDATE users
  SET 
    user_type = 'staff',
    role = 'admin',
    account_status = 'active',
    password_hash = COALESCE(password_hash, 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3'),
    updated_at = NOW()
  WHERE id = v_user_id;

  RAISE NOTICE '=== 更新完了 ===';
  RAISE NOTICE 'ログイン情報:';
  RAISE NOTICE '  メールアドレスまたはログインID: dev-test@example.com';
  RAISE NOTICE '  パスワード: 123';
END $$;

