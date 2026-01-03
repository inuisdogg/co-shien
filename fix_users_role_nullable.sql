-- ============================================
-- usersテーブルのroleをNULL許可にするマイグレーション
-- ============================================
-- 新しいキャリアプラットフォーム設計では、roleはemployment_recordsテーブルに移動
-- usersテーブルのroleカラムは後方互換性のため残すが、NULL許可にする

-- roleのNOT NULL制約を削除
ALTER TABLE users ALTER COLUMN role DROP NOT NULL;

-- 既存のデータでroleがNULLの場合は'staff'を設定（デフォルト値）
UPDATE users 
SET role = 'staff' 
WHERE role IS NULL;

-- 完了メッセージ
DO $$
BEGIN
  RAISE NOTICE 'usersテーブルのroleカラムをNULL許可に変更しました。';
  RAISE NOTICE '注意: 将来的にはroleカラムを削除し、employment_recordsテーブルのroleを使用する予定です。';
END $$;


