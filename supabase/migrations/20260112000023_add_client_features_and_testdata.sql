-- ============================================
-- 利用者側機能向けのスキーマ拡張
-- schedulesテーブルへのカラム追加とテストデータの投入
-- ============================================

-- schedulesテーブルに必要なカラムを追加
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS service_status TEXT;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS end_time TIME;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS calculated_time NUMERIC(5, 2);
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS memo TEXT;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS record_sheet_remarks TEXT;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS parent_signature TEXT;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS parent_signed_at TIMESTAMPTZ;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS absence_reason TEXT;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS request_status TEXT;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS request_reason TEXT;

-- childrenテーブルにowner_profile_idカラムを追加（既存の場合はスキップ）
ALTER TABLE children ADD COLUMN IF NOT EXISTS owner_profile_id TEXT REFERENCES users(id);

-- usersテーブルにuser_typeカラムを追加（利用者/スタッフの区別）
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'staff' CHECK (user_type IN ('staff', 'client'));

-- usersテーブルにlast_name, first_nameカラムを追加
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name_kana TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name_kana TEXT;

-- ============================================
-- テストデータ投入（開発環境用）
-- ============================================

-- 利用者アカウント（クライアント）を作成
-- 開発テストユーザー（dev-client-user-001）
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
  'dev-client-user-001',
  'client-test@example.com',
  'テスト 利用者',
  'テスト',
  '利用者',
  'client-test-001',
  -- password: client123
  '$2b$10$Xx8hPqXSr5p2JnXFHg.GbuKZqX5JLxhLXz2hB.xKqYmxz0hZJFz5e',
  'client',
  'client',
  'active'
) ON CONFLICT (id) DO UPDATE SET
  user_type = 'client',
  account_status = 'active';

-- 児童データを作成（利用者アカウントに紐付け）
-- デモ施設（facility-demo-001）と紐付けるテスト児童
INSERT INTO children (
  id,
  facility_id,
  owner_profile_id,
  name,
  name_kana,
  birth_date,
  guardian_name,
  guardian_name_kana,
  guardian_relationship,
  beneficiary_number,
  grant_days,
  contract_days,
  address,
  phone,
  email,
  needs_pickup,
  needs_dropoff,
  contract_status,
  contract_start_date
) VALUES (
  'dev-test-child-001',
  'facility-demo-001',
  'dev-client-user-001',
  'テスト太郎',
  'テストタロウ',
  '2018-04-15',
  'テスト 利用者',
  'テスト リヨウシャ',
  '母',
  '1234567890',
  23,
  15,
  '東京都渋谷区テスト町1-2-3',
  '090-1234-5678',
  'client-test@example.com',
  true,
  true,
  'active',
  '2024-04-01'
) ON CONFLICT (id) DO UPDATE SET
  owner_profile_id = 'dev-client-user-001',
  facility_id = 'facility-demo-001',
  contract_status = 'active';

-- 別の児童（同じ利用者アカウント）
INSERT INTO children (
  id,
  facility_id,
  owner_profile_id,
  name,
  name_kana,
  birth_date,
  guardian_name,
  guardian_relationship,
  beneficiary_number,
  grant_days,
  contract_days,
  needs_pickup,
  needs_dropoff,
  contract_status,
  contract_start_date
) VALUES (
  'dev-test-child-002',
  'facility-demo-001',
  'dev-client-user-001',
  'テスト花子',
  'テストハナコ',
  '2020-08-20',
  'テスト 利用者',
  '母',
  '0987654321',
  23,
  12,
  true,
  false,
  'active',
  '2024-06-01'
) ON CONFLICT (id) DO UPDATE SET
  owner_profile_id = 'dev-client-user-001',
  facility_id = 'facility-demo-001',
  contract_status = 'active';

-- 契約データを作成（児童と施設の紐付け）
INSERT INTO contracts (
  id,
  child_id,
  facility_id,
  status,
  contract_start_date,
  approved_at
) VALUES (
  'dev-contract-001',
  'dev-test-child-001',
  'facility-demo-001',
  'active',
  '2024-04-01',
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  status = 'active';

INSERT INTO contracts (
  id,
  child_id,
  facility_id,
  status,
  contract_start_date,
  approved_at
) VALUES (
  'dev-contract-002',
  'dev-test-child-002',
  'facility-demo-001',
  'active',
  '2024-06-01',
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  status = 'active';

-- 招待データのテスト用
-- まず招待用のadmin userがいなければ作成
INSERT INTO users (
  id,
  name,
  email,
  login_id,
  password_hash,
  role,
  user_type,
  account_status
) VALUES (
  'dev-admin-001',
  '管理者テスト',
  'admin-test@example.com',
  'admin-test-001',
  -- password: admin123
  '$2b$10$Xx8hPqXSr5p2JnXFHg.GbuKZqX5JLxhLXz2hB.xKqYmxz0hZJFz5e',
  'admin',
  'staff',
  'active'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO contract_invitations (
  id,
  facility_id,
  email,
  invitation_token,
  status,
  expires_at,
  invited_by
) VALUES (
  'dev-invitation-001',
  'facility-demo-001',
  'new-client@example.com',
  'test-invitation-token-001',
  'pending',
  NOW() + INTERVAL '7 days',
  'dev-admin-001'
) ON CONFLICT (id) DO NOTHING;

-- コメント追加
COMMENT ON COLUMN schedules.parent_signature IS '保護者のサイン画像（Base64形式）';
COMMENT ON COLUMN schedules.parent_signed_at IS '保護者のサイン日時';
COMMENT ON COLUMN schedules.service_status IS 'サービス提供状況（利用、欠席等）';
COMMENT ON COLUMN schedules.absence_reason IS '欠席理由';
COMMENT ON COLUMN schedules.request_status IS 'リクエスト状況（pending, approved, rejected）';
COMMENT ON COLUMN schedules.request_reason IS 'リクエスト理由';

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_children_owner_profile_id ON children(owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_users_user_type ON users(user_type);
