-- チャット機能デモ用のデータセットアップ
-- client-test-001 (dev-client-user-001) の子供をfacility-demo-001と契約

-- 1. 契約データを作成（既存のものがあればスキップ）
INSERT INTO contracts (id, child_id, facility_id, status, contract_start_date, created_at, updated_at)
SELECT 'contract-demo-001', 'dev-test-child-001', 'facility-demo-001', 'active', '2025-01-01', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM contracts WHERE child_id = 'dev-test-child-001' AND facility_id = 'facility-demo-001'
);

INSERT INTO contracts (id, child_id, facility_id, status, contract_start_date, created_at, updated_at)
SELECT 'contract-demo-002', 'dev-test-child-002', 'facility-demo-001', 'active', '2025-01-01', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM contracts WHERE child_id = 'dev-test-child-002' AND facility_id = 'facility-demo-001'
);

-- 2. 施設のスタッフユーザーを作成/更新
INSERT INTO users (
  id, email, name, login_id, password_hash, role, user_type,
  facility_id, account_status, created_at, updated_at
)
VALUES (
  'dev-staff-user-001',
  'staff-demo@example.com',
  'テスト スタッフ',
  'staff-demo-001',
  '186474c1f2c2f735a54c2cf82ee8e87f2a5cd30940e280029363fecedfc5328c', -- password: test1234
  'admin',
  'staff',
  'facility-demo-001',
  'active',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  facility_id = 'facility-demo-001',
  user_type = 'staff';

-- 3. スタッフをstaffテーブルにも登録
INSERT INTO staff (id, facility_id, name, role, type, user_id, created_at, updated_at)
VALUES (
  'staff-demo-001',
  'facility-demo-001',
  'テスト スタッフ',
  '管理者',
  '常勤',
  'dev-staff-user-001',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;
