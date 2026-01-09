-- 開発テストアカウントのパスワードハッシュを確認・修正

DO $$
DECLARE
  v_user_id TEXT;
  v_current_hash TEXT;
  v_correct_hash TEXT := 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3'; -- SHA-256('123')
BEGIN
  -- 開発テストユーザーを取得
  SELECT id, password_hash INTO v_user_id, v_current_hash
  FROM users
  WHERE name = '開発テスト' OR email = 'dev-test@example.com'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE '開発テストユーザーが見つかりません';
    RETURN;
  END IF;

  RAISE NOTICE 'ユーザーID: %', v_user_id;
  RAISE NOTICE '現在のパスワードハッシュ: %', v_current_hash;
  RAISE NOTICE '正しいパスワードハッシュ: %', v_correct_hash;

  -- パスワードハッシュを更新
  UPDATE users
  SET 
    password_hash = v_correct_hash,
    account_status = 'active',
    updated_at = NOW()
  WHERE id = v_user_id;

  RAISE NOTICE 'パスワードハッシュを更新しました';
  
  -- 確認
  SELECT password_hash INTO v_current_hash
  FROM users
  WHERE id = v_user_id;
  
  RAISE NOTICE '更新後のパスワードハッシュ: %', v_current_hash;
  RAISE NOTICE 'ハッシュが一致: %', (v_current_hash = v_correct_hash);
END $$;

