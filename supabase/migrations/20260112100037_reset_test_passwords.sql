-- テストアカウントのパスワードを test123 に統一

-- SHA-256 hash of 'test123'
-- ecd71870d1963316a97e3ac3408c9835ad8cf0f3c1bc703527c30265534f75ae

UPDATE users
SET password_hash = 'ecd71870d1963316a97e3ac3408c9835ad8cf0f3c1bc703527c30265534f75ae',
    updated_at = NOW()
WHERE login_id IN ('staff-test-001', 'client-test-001');

-- 確認
DO $$
DECLARE
  updated_count INT;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM users
  WHERE login_id IN ('staff-test-001', 'client-test-001')
    AND password_hash = 'ecd71870d1963316a97e3ac3408c9835ad8cf0f3c1bc703527c30265534f75ae';

  RAISE NOTICE 'パスワード更新数: %', updated_count;
END $$;
