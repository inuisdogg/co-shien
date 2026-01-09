-- koya.htk@gmail.comのアカウントにパスワードを設定
-- 一時的なパスワード: TempPass123!
-- ログイン後、必ずパスワードを変更してください

-- パスワードハッシュを設定
-- 一時的なパスワード: TempPass123!
-- SHA-256ハッシュ: 56d37b1dea780e1c6a6d77c117c96e6e2a4a5693aaa4258e94aabb39d5c6b2c8
UPDATE users
SET 
  password_hash = '56d37b1dea780e1c6a6d77c117c96e6e2a4a5693aaa4258e94aabb39d5c6b2c8',
  account_status = 'active',
  updated_at = NOW()
WHERE email = 'koya.htk@gmail.com' AND password_hash IS NULL;

