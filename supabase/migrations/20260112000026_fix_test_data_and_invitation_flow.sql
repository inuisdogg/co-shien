-- ============================================
-- テストデータ修正と招待フロー用テーブル拡張
-- ============================================

-- contract_invitationsテーブルに仮児童名カラムを追加
ALTER TABLE contract_invitations ADD COLUMN IF NOT EXISTS temp_child_name TEXT;
ALTER TABLE contract_invitations ADD COLUMN IF NOT EXISTS temp_child_name_kana TEXT;

-- 招待が承認された後に紐付けられる児童ID（保護者が選択した児童）
-- child_idは既に存在するが、これは承認後に設定される
COMMENT ON COLUMN contract_invitations.child_id IS '承認後に紐付けられる児童ID（保護者が選択）';
COMMENT ON COLUMN contract_invitations.temp_child_name IS '施設側が入力した仮の児童名（招待中のみ表示）';
COMMENT ON COLUMN contract_invitations.temp_child_name_kana IS '施設側が入力した仮の児童名カナ';

-- ============================================
-- テストデータの修正
-- ============================================

-- まず、既存のテスト児童のowner_profile_idを確認・修正
-- dev-client-user-001 が存在することを確認
DO $$
DECLARE
  v_user_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM users WHERE id = 'dev-client-user-001') INTO v_user_exists;

  IF NOT v_user_exists THEN
    RAISE NOTICE 'dev-client-user-001 が存在しません。作成します。';
    INSERT INTO users (
      id, email, name, login_id, password_hash, role, user_type, account_status
    ) VALUES (
      'dev-client-user-001',
      'client-test@example.com',
      'テスト 利用者',
      'client-test-001',
      '186474c1f2c2f735a54c2cf82ee8e87f2a5cd30940e280029363fecedfc5328c',
      'client',
      'client',
      'active'
    ) ON CONFLICT (id) DO UPDATE SET
      user_type = 'client',
      account_status = 'active';
  ELSE
    RAISE NOTICE 'dev-client-user-001 は存在します';
  END IF;
END $$;

-- テスト児童のowner_profile_idを設定
UPDATE children
SET owner_profile_id = 'dev-client-user-001'
WHERE id IN ('dev-test-child-001', 'dev-test-child-002');

-- 契約データが正しく存在することを確認
INSERT INTO contracts (
  id, child_id, facility_id, status, contract_start_date, approved_at
) VALUES (
  'dev-contract-001',
  'dev-test-child-001',
  'facility-demo-001',
  'active',
  '2024-04-01',
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  status = 'active',
  child_id = 'dev-test-child-001',
  facility_id = 'facility-demo-001';

INSERT INTO contracts (
  id, child_id, facility_id, status, contract_start_date, approved_at
) VALUES (
  'dev-contract-002',
  'dev-test-child-002',
  'facility-demo-001',
  'active',
  '2024-06-01',
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  status = 'active',
  child_id = 'dev-test-child-002',
  facility_id = 'facility-demo-001';

-- 確認用クエリ
DO $$
DECLARE
  child_count INT;
  contract_count INT;
BEGIN
  SELECT COUNT(*) INTO child_count
  FROM children
  WHERE owner_profile_id = 'dev-client-user-001';

  SELECT COUNT(*) INTO contract_count
  FROM contracts
  WHERE child_id IN ('dev-test-child-001', 'dev-test-child-002')
  AND status = 'active';

  RAISE NOTICE '利用者 dev-client-user-001 に紐付いた児童数: %', child_count;
  RAISE NOTICE 'アクティブな契約数: %', contract_count;
END $$;
