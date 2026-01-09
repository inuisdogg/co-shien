-- 「開発テスト」という名前のパーソナルアカウントを作成し、デモ施設と紐付け

DO $$
DECLARE
  v_user_id TEXT;
  v_facility_id TEXT;
  v_facility_name TEXT;
BEGIN
  -- デモ施設の1つを取得（最初の施設を使用）
  SELECT id, name INTO v_facility_id, v_facility_name
  FROM facilities
  WHERE id LIKE 'facility-demo-%'
  ORDER BY id
  LIMIT 1;

  IF v_facility_id IS NULL THEN
    RAISE NOTICE 'デモ施設が見つかりません';
    RETURN;
  END IF;

  RAISE NOTICE '施設ID: %, 施設名: %', v_facility_id, v_facility_name;

  -- 「開発テスト」という名前のユーザーが既に存在するか確認
  SELECT id INTO v_user_id
  FROM users
  WHERE name = '開発テスト'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    -- ユーザーが存在しない場合は作成
    v_user_id := gen_random_uuid()::TEXT;
    INSERT INTO users (
      id,
      email,
      name,
      last_name,
      first_name,
      user_type,
      role,
      account_status,
      facility_id,
      password_hash,
      has_account,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      'dev-test@example.com',
      '開発テスト',
      '開発',
      'テスト',
      'staff',
      'admin',
      'active',
      v_facility_id,
      'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3', -- SHA-256('123') のハッシュ（デフォルトパスワード）
      true,
      NOW(),
      NOW()
    );
    RAISE NOTICE '「開発テスト」ユーザーを作成しました: %', v_user_id;
  ELSE
    -- 既存のユーザーを更新
    UPDATE users
    SET 
      facility_id = v_facility_id,
      role = 'admin',
      user_type = 'staff',
      account_status = 'active',
      password_hash = COALESCE(password_hash, 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3'),
      updated_at = NOW()
    WHERE id = v_user_id;
    RAISE NOTICE '「開発テスト」ユーザーを更新しました: %', v_user_id;
  END IF;

  RAISE NOTICE '=== 完了 ===';
  RAISE NOTICE 'ユーザー「開発テスト」を施設 % (%) と紐付け、管理者権限を付与しました', 
    v_facility_name, v_facility_id;
  RAISE NOTICE 'ログイン情報: メールアドレスまたはログインID: dev-test@example.com, パスワード: 123';
END $$;

