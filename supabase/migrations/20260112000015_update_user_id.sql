-- 14b0354@gmail.comのユーザーIDを66937dee-0b4f-4d2b-b075-63656b21a94aに更新

DO $$
DECLARE
  v_old_user_id TEXT;
  v_new_user_id TEXT := '66937dee-0b4f-4d2b-b075-63656b21a94a';
  v_child_id TEXT;
  v_facility_id TEXT;
BEGIN
  -- 既存のユーザーIDを取得
  SELECT id INTO v_old_user_id FROM users WHERE email = '14b0354@gmail.com';
  
  IF v_old_user_id IS NULL THEN
    RAISE NOTICE 'ユーザー 14b0354@gmail.com が見つかりません';
    RETURN;
  END IF;

  IF v_old_user_id = v_new_user_id THEN
    RAISE NOTICE 'ユーザーIDは既に正しい値です: %', v_old_user_id;
    RETURN;
  END IF;

  RAISE NOTICE 'ユーザーIDを更新します: % -> %', v_old_user_id, v_new_user_id;

  -- まず、既存の児童のowner_profile_idを更新
  UPDATE children
  SET owner_profile_id = v_new_user_id,
      updated_at = NOW()
  WHERE owner_profile_id = v_old_user_id;

  -- 契約のapproved_byを更新
  UPDATE contracts
  SET approved_by = v_new_user_id,
      updated_at = NOW()
  WHERE approved_by = v_old_user_id;

  -- 最後に、usersテーブルのIDを更新
  -- 注意: これは外部キー制約があるため、慎重に行う必要がある
  -- まず、既存のIDでユーザーが存在するか確認
  IF EXISTS (SELECT 1 FROM users WHERE id = v_new_user_id) THEN
    RAISE NOTICE '新しいユーザーID % は既に存在します。スキップします。', v_new_user_id;
    RETURN;
  END IF;

  -- usersテーブルのIDを更新（外部キー制約を回避するため、一時的にNULLに設定してから更新）
  -- ただし、PostgreSQLでは直接IDを更新できないため、新しいレコードを作成して古いレコードを削除する必要がある
  -- または、外部キー制約を一時的に無効化する必要がある
  
  -- ここでは、新しいIDでユーザーを作成し、古いユーザーのデータをコピーする
  INSERT INTO users (
    id,
    email,
    name,
    last_name,
    first_name,
    user_type,
    role,
    account_status,
    password_hash,
    has_account,
    created_at,
    updated_at
  )
  SELECT 
    v_new_user_id,
    email,
    name,
    last_name,
    first_name,
    user_type,
    role,
    account_status,
    password_hash,
    has_account,
    created_at,
    NOW()
  FROM users
  WHERE id = v_old_user_id;

  -- 古いユーザーレコードを削除
  DELETE FROM users WHERE id = v_old_user_id;

  RAISE NOTICE 'ユーザーIDの更新が完了しました';

  -- テスト児童を作成（既に存在する場合はスキップ）
  SELECT id INTO v_child_id FROM children WHERE owner_profile_id = v_new_user_id LIMIT 1;
  
  IF v_child_id IS NULL THEN
    v_child_id := 'test-child-' || v_new_user_id;
    INSERT INTO children (
      id,
      owner_profile_id,
      facility_id,
      name,
      name_kana,
      birth_date,
      age,
      guardian_name,
      contract_status,
      created_at,
      updated_at
    ) VALUES (
      v_child_id,
      v_new_user_id,
      NULL,
      'テスト児童',
      'テストジドウ',
      '2020-01-01',
      4,
      'テスト利用者',
      'pre-contract',
      NOW(),
      NOW()
    );
    RAISE NOTICE 'テスト児童を作成しました: %', v_child_id;
  END IF;

  -- 3つのデモ施設と契約を作成
  FOR v_facility_id IN 
    SELECT id FROM facilities WHERE id LIKE 'facility-demo-%' ORDER BY id
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM contracts 
      WHERE child_id = v_child_id
      AND facility_id = v_facility_id
      AND status = 'active'
    ) THEN
      INSERT INTO contracts (
        id,
        child_id,
        facility_id,
        status,
        contract_start_date,
        requested_at,
        approved_at,
        approved_by,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid()::TEXT,
        v_child_id,
        v_facility_id,
        'active',
        CURRENT_DATE,
        NOW(),
        NOW(),
        v_new_user_id,
        NOW(),
        NOW()
      );
      RAISE NOTICE '施設 % との契約を作成しました', v_facility_id;
    END IF;
  END LOOP;

  RAISE NOTICE 'テストデータの紐付けが完了しました';
END $$;

