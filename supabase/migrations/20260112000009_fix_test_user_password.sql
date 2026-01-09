-- 既存の14b0354@gmail.comアカウントのパスワードを確認し、必要に応じてリセット
-- 既存のパスワードハッシュがある場合は保持し、ない場合のみ設定

DO $$
DECLARE
  v_user_id TEXT;
  v_existing_password_hash TEXT;
BEGIN
  -- ユーザーを取得
  SELECT id, password_hash INTO v_user_id, v_existing_password_hash
  FROM users 
  WHERE email = '14b0354@gmail.com';
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'ユーザー 14b0354@gmail.com が見つかりません';
    RETURN;
  END IF;

  -- 既存のパスワードハッシュがある場合は保持
  IF v_existing_password_hash IS NOT NULL AND v_existing_password_hash != '' THEN
    RAISE NOTICE '既存のパスワードハッシュを保持します（ユーザーID: %）', v_user_id;
    -- ユーザータイプとロールのみ更新
    UPDATE users
    SET 
      user_type = 'client',
      role = 'client',
      account_status = 'active',
      updated_at = NOW()
    WHERE id = v_user_id;
  ELSE
    -- パスワードハッシュがない場合のみ設定（SHA-256('123') のハッシュ）
    UPDATE users
    SET 
      user_type = 'client',
      role = 'client',
      account_status = 'active',
      password_hash = 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3', -- SHA-256('123')
      updated_at = NOW()
    WHERE id = v_user_id;
    RAISE NOTICE 'パスワードハッシュを設定しました（ユーザーID: %）', v_user_id;
  END IF;

  RAISE NOTICE 'ユーザー % の更新が完了しました', v_user_id;
END $$;

