-- 重複している児童データを削除

-- まず契約を削除（外部キー制約のため）
DELETE FROM contracts WHERE child_id = 'dev-test-child-002';

-- 児童を削除
DELETE FROM children WHERE id = 'dev-test-child-002';

-- 確認
DO $$
DECLARE
  child_count INT;
BEGIN
  SELECT COUNT(*) INTO child_count
  FROM children
  WHERE owner_profile_id = 'dev-client-user-001';

  RAISE NOTICE '残りの児童数: %', child_count;
END $$;
