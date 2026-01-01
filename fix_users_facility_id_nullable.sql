-- ============================================
-- usersテーブルのfacility_idをNULL許可にするマイグレーション
-- ============================================
-- 新しいキャリアプラットフォーム設計では、usersテーブルからfacility_idを削除予定
-- その前段階として、facility_idをNULL許可にする

-- facility_idのNOT NULL制約を削除
ALTER TABLE users ALTER COLUMN facility_id DROP NOT NULL;

-- 既存のデータでfacility_idがNULLの場合は、invited_by_facility_idから設定
UPDATE users 
SET facility_id = invited_by_facility_id 
WHERE facility_id IS NULL AND invited_by_facility_id IS NOT NULL;

-- 完了メッセージ
DO $$
BEGIN
  RAISE NOTICE 'usersテーブルのfacility_idカラムをNULL許可に変更しました。';
  RAISE NOTICE '注意: 将来的にはfacility_idカラムを削除する予定です。';
END $$;

