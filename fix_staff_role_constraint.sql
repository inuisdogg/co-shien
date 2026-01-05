-- ============================================
-- staffテーブルのrole制約を修正
-- ============================================
-- 管理者を追加するためにCHECK制約を更新

-- 既存のCHECK制約を削除
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_role_check;

-- 新しいCHECK制約を追加（'管理者'を含む）
ALTER TABLE staff ADD CONSTRAINT staff_role_check 
  CHECK (role IN ('一般スタッフ', 'マネージャー', '管理者'));

-- 完了メッセージ
DO $$
BEGIN
  RAISE NOTICE 'staffテーブルのrole制約を更新しました！';
  RAISE NOTICE '許可される値: ''一般スタッフ'', ''マネージャー'', ''管理者''';
END $$;


