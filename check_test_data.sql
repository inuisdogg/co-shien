-- テストデータの紐付け状態を確認

-- 1. ユーザー情報を確認
SELECT 
  id,
  email,
  name,
  user_type,
  role,
  account_status,
  password_hash IS NOT NULL as has_password
FROM users 
WHERE email = '14b0354@gmail.com';

-- 2. 児童情報を確認
SELECT 
  c.id,
  c.name,
  c.owner_profile_id,
  u.email as owner_email,
  c.contract_status
FROM children c
LEFT JOIN users u ON c.owner_profile_id = u.id
WHERE u.email = '14b0354@gmail.com';

-- 3. 契約情報を確認
SELECT 
  ct.id,
  ct.child_id,
  c.name as child_name,
  ct.facility_id,
  f.name as facility_name,
  ct.status,
  ct.contract_start_date
FROM contracts ct
LEFT JOIN children c ON ct.child_id = c.id
LEFT JOIN users u ON c.owner_profile_id = u.id
LEFT JOIN facilities f ON ct.facility_id = f.id
WHERE u.email = '14b0354@gmail.com';

-- 4. デモ施設を確認
SELECT id, name, code FROM facilities WHERE id LIKE 'facility-demo-%' ORDER BY id;

