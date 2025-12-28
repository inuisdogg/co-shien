-- ============================================
-- pocopoco施設の新規登録
-- ============================================
-- このSQLスクリプトは、pocopoco施設と初期管理者アカウントを作成します

-- 施設ID（一意のIDを生成）
-- 実際の運用では、UUIDや施設コードを使用してください
DO $$
DECLARE
  v_facility_id TEXT := 'pocopoco-001';
  v_admin_id TEXT := 'admin-pocopoco-001';
  v_admin_password_hash TEXT := '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8'; -- "password"のSHA-256ハッシュ
BEGIN
  -- 1. 施設を作成
  INSERT INTO facilities (id, name, code, created_at, updated_at)
  VALUES (
    v_facility_id,
    'pocopoco',
    'POCOPOCO001',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  -- 2. 初期管理者アカウントを作成
  INSERT INTO users (id, facility_id, name, login_id, email, role, password_hash, has_account, permissions, created_at, updated_at)
  VALUES (
    v_admin_id,
    v_facility_id,
    '管理者',
    'admin', -- ログインID
    NULL, -- メールアドレスは不要
    'admin',
    v_admin_password_hash,
    true,
    '{}'::JSONB, -- 管理者は全権限のため空のJSONB
    NOW(),
    NOW()
  )
  ON CONFLICT (facility_id, login_id) DO NOTHING;

  -- 3. 施設設定を作成
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

  RAISE NOTICE 'pocopoco施設と初期管理者アカウントを作成しました！';
  RAISE NOTICE '施設ID: %', v_facility_id;
  RAISE NOTICE '管理者名: 管理者';
  RAISE NOTICE 'ログインID: admin';
  RAISE NOTICE '初期パスワード: password';
  RAISE NOTICE '※ 初回ログイン後、必ずパスワードを変更してください';
END $$;

