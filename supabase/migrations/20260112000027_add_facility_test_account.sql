-- 施設側テストアカウントの作成

-- 施設スタッフアカウントを作成
INSERT INTO users (
  id,
  email,
  name,
  last_name,
  first_name,
  login_id,
  password_hash,
  role,
  user_type,
  account_status
) VALUES (
  'dev-facility-staff-001',
  'staff-test@example.com',
  'テスト スタッフ',
  'テスト',
  'スタッフ',
  'staff-test-001',
  -- password: staff123 (SHA-256)
  '10176e7b7b24d317acfcf8d2064cfd2f24e154f7b5a96603077d5ef813d6a6b6',
  'staff',
  'staff',
  'active'
) ON CONFLICT (id) DO UPDATE SET
  login_id = 'staff-test-001',
  password_hash = '10176e7b7b24d317acfcf8d2064cfd2f24e154f7b5a96603077d5ef813d6a6b6',
  user_type = 'staff',
  account_status = 'active';

-- 施設管理者アカウントを作成
INSERT INTO users (
  id,
  email,
  name,
  last_name,
  first_name,
  login_id,
  password_hash,
  role,
  user_type,
  account_status
) VALUES (
  'dev-facility-admin-001',
  'facility-admin@example.com',
  '施設管理者 テスト',
  '施設管理者',
  'テスト',
  'facility-admin-001',
  -- password: admin123 (SHA-256)
  '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
  'admin',
  'staff',
  'active'
) ON CONFLICT (id) DO UPDATE SET
  login_id = 'facility-admin-001',
  password_hash = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
  user_type = 'staff',
  account_status = 'active';

-- ユーザーと施設の紐付け（facility_users テーブルがあれば）
DO $$
BEGIN
  -- facility_usersテーブルが存在するか確認
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'facility_users') THEN
    -- スタッフを施設に紐付け
    INSERT INTO facility_users (user_id, facility_id, role)
    VALUES ('dev-facility-staff-001', 'facility-demo-001', 'staff')
    ON CONFLICT DO NOTHING;

    INSERT INTO facility_users (user_id, facility_id, role)
    VALUES ('dev-facility-admin-001', 'facility-demo-001', 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- usersテーブルにfacility_idカラムがあれば設定
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'facility_id') THEN
    UPDATE users SET facility_id = 'facility-demo-001' WHERE id IN ('dev-facility-staff-001', 'dev-facility-admin-001');
  END IF;
END $$;
