-- ログインしているユーザーを特定し、テストデータと紐付け

DO $$
DECLARE
  v_user_id TEXT;
  v_user_email TEXT;
  v_child_id TEXT;
  v_facility_id TEXT;
BEGIN
  -- まず、14b0354@gmail.comのユーザーを確認
  SELECT id, email INTO v_user_id, v_user_email FROM users WHERE email = '14b0354@gmail.com';
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'ユーザー 14b0354@gmail.com が見つかりません';
    RETURN;
  END IF;

  RAISE NOTICE 'ユーザーID: %, メール: %', v_user_id, v_user_email;

  -- 児童を確認・作成
  SELECT id INTO v_child_id FROM children WHERE owner_profile_id = v_user_id LIMIT 1;
  
  IF v_child_id IS NULL THEN
    -- 児童が存在しない場合は作成
    v_child_id := 'test-child-' || v_user_id;
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
      v_user_id,
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
  ELSE
    RAISE NOTICE 'テスト児童は既に存在します: %', v_child_id;
  END IF;

  -- 3つのデモ施設と契約を作成
  FOR v_facility_id IN 
    SELECT id FROM facilities WHERE id LIKE 'facility-demo-%' ORDER BY id
  LOOP
    -- 既存の契約をチェック
    IF NOT EXISTS (
      SELECT 1 FROM contracts 
      WHERE child_id = v_child_id
      AND facility_id = v_facility_id
      AND status = 'active'
    ) THEN
      -- 契約を作成
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
        v_user_id,
        NOW(),
        NOW()
      );
      RAISE NOTICE '施設 % との契約を作成しました', v_facility_id;
    ELSE
      RAISE NOTICE '施設 % との契約は既に存在します', v_facility_id;
    END IF;
  END LOOP;

  RAISE NOTICE 'テストデータの紐付けが完了しました';
END $$;

