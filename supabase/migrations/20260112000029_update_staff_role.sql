-- スタッフのroleを管理者に変更（Bizダッシュボードにアクセスできるように）

-- employment_recordsのroleを更新
UPDATE employment_records
SET role = '管理者'
WHERE user_id = 'dev-facility-staff-001';

-- usersテーブルのroleも更新
UPDATE users
SET role = 'admin'
WHERE id = 'dev-facility-staff-001';
