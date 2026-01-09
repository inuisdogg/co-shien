-- 「開発テスト」という名前のパーソナルアカウントをデモ施設の1つと紐付け、管理者権限を付与

DO $$
DECLARE
  v_user_id TEXT;
  v_facility_id TEXT;
  v_user_name TEXT;
BEGIN
  -- 「開発テスト」という名前のユーザーを検索
  SELECT id, name INTO v_user_id, v_user_name
  FROM users
  WHERE name LIKE '%開発テスト%' OR name = '開発テスト'
  LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE '「開発テスト」という名前のユーザーが見つかりません。nameカラムに「開発テスト」を含むユーザーを検索します。';
    -- より広範囲に検索
    SELECT id, name INTO v_user_id, v_user_name
    FROM users
    WHERE name LIKE '%開発%' OR name LIKE '%テスト%'
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_user_id IS NULL THEN
      RAISE NOTICE '該当するユーザーが見つかりませんでした';
      RETURN;
    END IF;
  END IF;

  RAISE NOTICE 'ユーザーID: %, 名前: %', v_user_id, v_user_name;

  -- デモ施設の1つを取得（最初の施設を使用）
  SELECT id INTO v_facility_id
  FROM facilities
  WHERE id LIKE 'facility-demo-%'
  ORDER BY id
  LIMIT 1;

  IF v_facility_id IS NULL THEN
    RAISE NOTICE 'デモ施設が見つかりません';
    RETURN;
  END IF;

  RAISE NOTICE '施設ID: %', v_facility_id;

  -- ユーザーを施設と紐付け、管理者権限を付与
  UPDATE users
  SET 
    facility_id = v_facility_id,
    role = 'admin',
    user_type = 'staff',
    account_status = 'active',
    updated_at = NOW()
  WHERE id = v_user_id;

  RAISE NOTICE 'ユーザー % を施設 % と紐付け、管理者権限を付与しました', v_user_id, v_facility_id;
END $$;

