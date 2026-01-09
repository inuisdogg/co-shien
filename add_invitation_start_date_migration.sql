-- ============================================
-- 招待情報に雇用開始日を追加するマイグレーション
-- ============================================
-- 事業所がスタッフを招待する際に、雇用開始日を指定できるようにする

-- usersテーブルに招待時の雇用開始日を保存するカラムを追加
ALTER TABLE users ADD COLUMN IF NOT EXISTS invitation_start_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS invitation_role TEXT CHECK (invitation_role IN ('一般スタッフ', 'マネージャー', '管理者'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS invitation_employment_type TEXT CHECK (invitation_employment_type IN ('常勤', '非常勤'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS invitation_permissions JSONB DEFAULT '{}'::JSONB;

-- ============================================
-- 完了メッセージ
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '招待情報に雇用開始日を追加するマイグレーションが完了しました！';
  RAISE NOTICE '追加されたカラム:';
  RAISE NOTICE '  - invitation_start_date (雇用開始日)';
  RAISE NOTICE '  - invitation_role (役割)';
  RAISE NOTICE '  - invitation_employment_type (雇用形態)';
  RAISE NOTICE '  - invitation_permissions (権限設定)';
END $$;







