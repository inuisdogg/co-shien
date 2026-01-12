-- テスト用契約データを作成

-- 既存の契約があれば削除
DELETE FROM contracts
WHERE child_id = 'dev-test-child-002' AND facility_id = 'facility-demo-001';

-- 契約を作成
INSERT INTO contracts (
  id,
  child_id,
  facility_id,
  status,
  contract_start_date
) VALUES (
  'dev-contract-002',
  'dev-test-child-002',
  'facility-demo-001',
  'active',
  '2024-04-01'
);

-- 確認
DO $$
DECLARE
  contract_count INT;
BEGIN
  SELECT COUNT(*) INTO contract_count
  FROM contracts
  WHERE child_id = 'dev-test-child-002' AND facility_id = 'facility-demo-001';

  RAISE NOTICE '契約数: %', contract_count;
END $$;
