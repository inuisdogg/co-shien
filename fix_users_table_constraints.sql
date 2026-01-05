-- ============================================
-- usersテーブルの制約を修正するマイグレーション
-- ============================================
-- 新しいキャリアプラットフォーム設計に合わせて、
-- usersテーブルの制約を緩和する

-- 1. facility_idのNOT NULL制約を削除
ALTER TABLE users ALTER COLUMN facility_id DROP NOT NULL;

-- 2. roleのNOT NULL制約を削除
ALTER TABLE users ALTER COLUMN role DROP NOT NULL;

-- 3. 既存のデータでfacility_idがNULLの場合は、invited_by_facility_idから設定
UPDATE users 
SET facility_id = invited_by_facility_id 
WHERE facility_id IS NULL AND invited_by_facility_id IS NOT NULL;

-- 4. 既存のデータでroleがNULLの場合は'staff'を設定（デフォルト値）
UPDATE users 
SET role = 'staff' 
WHERE role IS NULL;

-- 完了メッセージ
DO $$
BEGIN
  RAISE NOTICE 'usersテーブルの制約を修正しました:';
  RAISE NOTICE '  - facility_id: NULL許可に変更';
  RAISE NOTICE '  - role: NULL許可に変更';
  RAISE NOTICE '';
  RAISE NOTICE '注意: 将来的には以下のカラムを削除する予定です:';
  RAISE NOTICE '  - facility_id (employment_recordsテーブルで管理)';
  RAISE NOTICE '  - role (employment_recordsテーブルで管理)';
END $$;



