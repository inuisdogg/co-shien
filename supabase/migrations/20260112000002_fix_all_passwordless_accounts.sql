-- パスワードが設定されていないアクティブなアカウントを確認し、修正

-- パスワードが設定されていないアクティブなアカウントを確認
SELECT 
  id,
  email,
  name,
  user_type,
  role,
  account_status,
  password_hash IS NULL as has_no_password
FROM users
WHERE account_status = 'active' AND password_hash IS NULL;

-- 注意: これらのアカウントは一時的に'pending'ステータスに変更するか、
-- パスワードリセット機能を使用してパスワードを設定する必要があります
-- ここでは、アカウントステータスを'pending'に変更して、パスワード設定を必須にします
UPDATE users
SET 
  account_status = 'pending',
  updated_at = NOW()
WHERE account_status = 'active' AND password_hash IS NULL;

-- 更新後の確認
SELECT 
  id,
  email,
  name,
  user_type,
  role,
  account_status,
  password_hash IS NULL as has_no_password
FROM users
WHERE password_hash IS NULL;

