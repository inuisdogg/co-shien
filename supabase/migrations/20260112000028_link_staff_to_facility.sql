-- スタッフアカウントを施設に紐付け

-- usersテーブルのfacility_idを設定
UPDATE users
SET facility_id = 'facility-demo-001'
WHERE id IN ('dev-facility-staff-001', 'dev-facility-admin-001');

-- employment_recordsにも追加（勤務履歴）
INSERT INTO employment_records (
  id,
  user_id,
  facility_id,
  start_date,
  role,
  employment_type
) VALUES (
  'emp-staff-001',
  'dev-facility-staff-001',
  'facility-demo-001',
  '2024-04-01',
  '一般スタッフ',
  '常勤'
) ON CONFLICT (user_id, facility_id) DO NOTHING;

INSERT INTO employment_records (
  id,
  user_id,
  facility_id,
  start_date,
  role,
  employment_type
) VALUES (
  'emp-admin-001',
  'dev-facility-admin-001',
  'facility-demo-001',
  '2024-01-01',
  '管理者',
  '常勤'
) ON CONFLICT (user_id, facility_id) DO NOTHING;

-- 紐付け確認
DO $$
DECLARE
  emp_count INT;
BEGIN
  SELECT COUNT(*) INTO emp_count
  FROM employment_records
  WHERE user_id IN ('dev-facility-staff-001', 'dev-facility-admin-001');

  RAISE NOTICE '施設に紐付けられたスタッフ数: %', emp_count;
END $$;
