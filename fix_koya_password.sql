-- koya.htk@gmail.comのアカウントにパスワードを設定するスクリプト
-- 一時的なパスワード: TempPass123!
-- ログイン後、必ずパスワードを変更してください

-- まず、現在のアカウント状態を確認
SELECT 
  id,
  email,
  name,
  user_type,
  role,
  account_status,
  password_hash IS NULL as has_no_password
FROM users
WHERE email = 'koya.htk@gmail.com';

-- パスワードハッシュを設定
-- 一時的なパスワード: TempPass123!
-- SHA-256ハッシュ: 56d37b1dea780e1c6a6d77c117c96e6e2a4a5693aaa4258e94aabb39d5c6b2c8
UPDATE users
SET 
  password_hash = '56d37b1dea780e1c6a6d77c117c96e6e2a4a5693aaa4258e94aabb39d5c6b2c8',
  account_status = 'active',
  updated_at = NOW()
WHERE email = 'koya.htk@gmail.com';

-- 更新後の確認
SELECT 
  id,
  email,
  name,
  user_type,
  role,
  account_status,
  password_hash IS NOT NULL as has_password,
  updated_at
FROM users
WHERE email = 'koya.htk@gmail.com';

