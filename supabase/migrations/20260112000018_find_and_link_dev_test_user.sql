-- 「開発テスト」という名前のユーザーを検索し、デモ施設と紐付け

DO $$
DECLARE
  v_user_id TEXT;
  v_user_name TEXT;
  v_user_email TEXT;
  v_facility_id TEXT;
  v_facility_name TEXT;
BEGIN
  -- まず、すべてのスタッフアカウントを確認
  RAISE NOTICE '=== スタッフアカウント一覧 ===';
  FOR v_user_id, v_user_name, v_user_email IN
    SELECT id, name, email
    FROM users
    WHERE user_type = 'staff' OR role = 'staff' OR role = 'admin'
    ORDER BY created_at DESC
    LIMIT 10
  LOOP
    RAISE NOTICE 'ID: %, 名前: %, メール: %', v_user_id, v_user_name, v_user_email;
  END LOOP;

  -- 「開発テスト」という名前のユーザーを検索（部分一致も含む）
  SELECT id, name, email INTO v_user_id, v_user_name, v_user_email
  FROM users
  WHERE (
    name LIKE '%開発テスト%' 
    OR name LIKE '%開発%テスト%'
    OR name = '開発テスト'
    OR email LIKE '%dev%'
    OR email LIKE '%test%'
  )
  AND (user_type = 'staff' OR role IN ('staff', 'admin'))
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_user_id IS NULL THEN
    -- 見つからない場合は、最新のスタッフアカウントを使用
    RAISE NOTICE '「開発テスト」という名前のユーザーが見つかりません。最新のスタッフアカウントを使用します。';
    SELECT id, name, email INTO v_user_id, v_user_name, v_user_email
    FROM users
    WHERE user_type = 'staff' OR role IN ('staff', 'admin')
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_user_id IS NULL THEN
      RAISE NOTICE 'スタッフアカウントが見つかりませんでした';
      RETURN;
    END IF;
  END IF;

  RAISE NOTICE '=== 選択されたユーザー ===';
  RAISE NOTICE 'ユーザーID: %', v_user_id;
  RAISE NOTICE '名前: %', v_user_name;
  RAISE NOTICE 'メール: %', v_user_email;

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

  RAISE NOTICE '=== 選択された施設 ===';
  RAISE NOTICE '施設ID: %', v_facility_id;
  RAISE NOTICE '施設名: %', v_facility_name;

  -- ユーザーを施設と紐付け、管理者権限を付与（パスワードハッシュがない場合は設定）
  UPDATE users
  SET 
    facility_id = v_facility_id,
    role = 'admin',
    user_type = 'staff',
    account_status = 'active',
    password_hash = COALESCE(password_hash, 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3'), -- SHA-256('123') のハッシュ（デフォルトパスワード）
    updated_at = NOW()
  WHERE id = v_user_id;

  RAISE NOTICE '=== 更新完了 ===';
  RAISE NOTICE 'ユーザー % (%) を施設 % (%) と紐付け、管理者権限を付与しました', 
    v_user_name, v_user_id, v_facility_name, v_facility_id;
END $$;

