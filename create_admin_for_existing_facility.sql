-- ============================================
-- 既存施設情報と連動した管理者アカウント作成
-- ============================================
-- 施設名: pocopoco
-- 管理者名: 畠昂哉
-- ログインID: hatake.koya
-- パスワード: pocopoco2025

DO $$
DECLARE
  v_facility_id TEXT;
  v_admin_id TEXT;
  v_admin_password_hash TEXT := 'f6af08dba72f394a2b7a727f3b284ceb881d8dee76d136a55241565777ba6687'; -- pocopoco2025のSHA-256ハッシュ
  v_facility_code TEXT;
BEGIN
  
  -- 既存のfacility_settingsからfacility_idを取得（施設名がpocopocoのもの）
  SELECT facility_id INTO v_facility_id
  FROM facility_settings
  WHERE facility_name = 'pocopoco'
  LIMIT 1;

  -- 施設が見つからない場合は、facilitiesテーブルから検索
  IF v_facility_id IS NULL THEN
    SELECT id INTO v_facility_id
    FROM facilities
    WHERE name = 'pocopoco'
    LIMIT 1;
  END IF;

  -- 施設が見つからない場合は、新しく作成
  IF v_facility_id IS NULL THEN
    v_facility_id := 'facility-pocopoco-' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS');
    
    -- 5桁のランダムな施設コードを生成（10000-99999）
    LOOP
      v_facility_code := LPAD((FLOOR(RANDOM() * 90000) + 10000)::TEXT, 5, '0');
      -- 既に存在するコードでないか確認
      IF NOT EXISTS (SELECT 1 FROM facilities WHERE code = v_facility_code) THEN
        EXIT;
      END IF;
    END LOOP;
    
    -- 施設を作成
    INSERT INTO facilities (id, name, code, created_at, updated_at)
    VALUES (
      v_facility_id,
      'pocopoco',
      v_facility_code,
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    -- 施設設定が存在しない場合は作成
    INSERT INTO facility_settings (facility_id, facility_name, regular_holidays, custom_holidays, business_hours, capacity, created_at, updated_at)
    VALUES (
      v_facility_id,
      'pocopoco',
      ARRAY[0], -- 日曜日を定休日
      ARRAY[]::TEXT[],
      '{"AM": {"start": "09:00", "end": "12:00"}, "PM": {"start": "13:00", "end": "18:00"}}'::JSONB,
      '{"AM": 10, "PM": 10}'::JSONB,
      NOW(),
      NOW()
    )
    ON CONFLICT (facility_id) DO NOTHING;
  ELSE
    -- facility_idが見つかった場合、facilitiesテーブルに存在するか確認
    -- 存在しない場合は作成
    -- 既に施設コードが設定されているか確認
    SELECT code INTO v_facility_code
    FROM facilities
    WHERE id = v_facility_id;
    
    -- 施設コードが設定されていない場合、5桁のランダムな番号を生成
    IF v_facility_code IS NULL OR v_facility_code = '' THEN
      LOOP
        v_facility_code := LPAD((FLOOR(RANDOM() * 90000) + 10000)::TEXT, 5, '0');
        -- 既に存在するコードでないか確認
        IF NOT EXISTS (SELECT 1 FROM facilities WHERE code = v_facility_code AND id != v_facility_id) THEN
          EXIT;
        END IF;
      END LOOP;
      
      INSERT INTO facilities (id, name, code, created_at, updated_at)
      VALUES (
        v_facility_id,
        'pocopoco',
        v_facility_code,
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET code = EXCLUDED.code, updated_at = NOW();
    END IF;
  END IF;

  -- 管理者IDを生成
  v_admin_id := 'admin-' || v_facility_id;
  
  -- 既存の管理者アカウントをチェック
  SELECT id INTO v_admin_id
  FROM users
  WHERE facility_id = v_facility_id AND login_id = 'hatake.koya'
  LIMIT 1;

  -- 既存のアカウントがある場合は更新、ない場合は新規作成
  IF v_admin_id IS NOT NULL THEN
    -- 既存のアカウントを更新
    UPDATE users
    SET
      name = '畠昂哉',
      password_hash = v_admin_password_hash,
      has_account = true,
      updated_at = NOW()
    WHERE id = v_admin_id;
  ELSE
    -- 新しいアカウントを作成
    v_admin_id := 'admin-' || v_facility_id || '-' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS');
    
    INSERT INTO users (id, facility_id, name, login_id, email, role, password_hash, has_account, permissions, created_at, updated_at)
    VALUES (
      v_admin_id,
      v_facility_id,
      '畠昂哉',
      'hatake.koya',
      NULL,
      'admin',
      v_admin_password_hash,
      true,
      '{}'::JSONB,
      NOW(),
      NOW()
    );
  END IF;

  -- 施設コードを取得して表示
  SELECT code INTO v_facility_code
  FROM facilities
  WHERE id = v_facility_id;

  RAISE NOTICE '管理者アカウントを作成しました！';
  RAISE NOTICE '施設ID: %', v_facility_id;
  RAISE NOTICE '施設コード: %', v_facility_code;
  RAISE NOTICE '管理者名: 畠昂哉';
  RAISE NOTICE 'ログインID: hatake.koya';
  RAISE NOTICE 'パスワード: pocopoco2025';
  RAISE NOTICE '';
  RAISE NOTICE '※ 既存の施設情報（pocopoco）と連動させました。';
  RAISE NOTICE '※ ログイン時に使用する施設IDは「%」です。', v_facility_code;
  RAISE NOTICE '※ ログインID: hatake.koya、パスワード: pocopoco2025 でログインできます。';
END $$;

