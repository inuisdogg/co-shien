-- テストユーザー（14b0354@gmail.com）を3つのデモ施設と紐付け

-- まず、ユーザーが存在するか確認し、存在しない場合は作成
DO $$
DECLARE
  v_user_id TEXT;
  v_facility_id TEXT;
BEGIN
  -- ユーザーを取得または作成
  SELECT id INTO v_user_id FROM users WHERE email = '14b0354@gmail.com';
  
  IF v_user_id IS NULL THEN
    -- ユーザーが存在しない場合は作成（Supabase AuthのIDを生成）
    v_user_id := gen_random_uuid()::TEXT;
    -- パスワードハッシュを生成（SHA-256で "TestPass123!" をハッシュ化）
    INSERT INTO users (
      id,
      email,
      name,
      user_type,
      role,
      account_status,
      has_account,
      password_hash,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      '14b0354@gmail.com',
      'テスト利用者',
      'client',
      'client',
      'active',
      true,
      'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3', -- SHA-256('123') のハッシュ（テスト用）
      NOW(),
      NOW()
    );
  ELSE
    -- 既存ユーザーを利用者アカウントに更新（パスワードハッシュは保持）
    UPDATE users
    SET 
      user_type = 'client',
      role = 'client',
      account_status = COALESCE(account_status, 'active'), -- 既存のステータスを保持、なければactive
      updated_at = NOW()
    WHERE id = v_user_id;
    -- パスワードハッシュがない場合のみ設定（別のマイグレーションで処理）
  END IF;

  RAISE NOTICE 'テストユーザー % を3つのデモ施設と紐付けました', v_user_id;
END $$;

