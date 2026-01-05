-- ============================================
-- 施設の関連情報を確認して、正しい施設IDを特定
-- ============================================

-- 1. facilitiesテーブルの全レコード
SELECT 'facilitiesテーブル' as table_name, id, name, code, updated_at
FROM facilities
WHERE name = 'pocopoco'
ORDER BY updated_at DESC;

-- 2. facility_settingsテーブルとの関連
SELECT 
  'facility_settings' as table_name,
  fs.facility_id,
  fs.facility_name,
  f.code as facility_code,
  f.updated_at
FROM facility_settings fs
LEFT JOIN facilities f ON fs.facility_id = f.id
WHERE fs.facility_name = 'pocopoco';

-- 3. usersテーブルとの関連
SELECT 
  'usersテーブル' as table_name,
  u.id as user_id,
  u.facility_id,
  u.name as user_name,
  u.login_id,
  f.code as facility_code,
  f.name as facility_name
FROM users u
LEFT JOIN facilities f ON u.facility_id = f.id
WHERE f.name = 'pocopoco' OR u.facility_id IN (
  SELECT id FROM facilities WHERE name = 'pocopoco'
);

-- 4. staffテーブルとの関連
SELECT 
  'staffテーブル' as table_name,
  s.id as staff_id,
  s.facility_id,
  s.name as staff_name,
  f.code as facility_code,
  f.name as facility_name
FROM staff s
LEFT JOIN facilities f ON s.facility_id = f.id
WHERE f.name = 'pocopoco' OR s.facility_id IN (
  SELECT id FROM facilities WHERE name = 'pocopoco'
)
LIMIT 5;



