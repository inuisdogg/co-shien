-- クライアントテストユーザーのパスワードハッシュを修正
-- アプリはSHA-256を使用しているため、bcrypt形式ではなくSHA-256ハッシュを使用

-- client123 のSHA-256ハッシュ
UPDATE users
SET password_hash = '186474c1f2c2f735a54c2cf82ee8e87f2a5cd30940e280029363fecedfc5328c'
WHERE id = 'dev-client-user-001';

-- dev-admin-001 も修正（admin123のSHA-256ハッシュ）
-- admin123 = 240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9
UPDATE users
SET password_hash = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9'
WHERE id = 'dev-admin-001';
