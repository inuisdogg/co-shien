-- ユーザー確認用SQL
SELECT id, email, name, role, account_status, created_at 
FROM users 
WHERE email = 'koya.htk@gmail.com';

-- 全ユーザー一覧（最新10件）
SELECT id, email, name, role, account_status, created_at 
FROM users 
ORDER BY created_at DESC 
LIMIT 10;

