-- ============================================
-- ログインID機能追加マイグレーション
-- ============================================
-- usersテーブルにlogin_idカラムを追加（ログイン時に使用）

-- usersテーブルにlogin_idカラムを追加
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_id TEXT;

-- login_idにユニーク制約を追加（施設内で一意）
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_facility_login_id ON users(facility_id, login_id) WHERE login_id IS NOT NULL;

-- 既存のデータがある場合、nameをlogin_idとして設定（後方互換性）
UPDATE users SET login_id = name WHERE login_id IS NULL;

-- ============================================
-- 完了メッセージ
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'ログインID機能のマイグレーションが完了しました！';
  RAISE NOTICE 'usersテーブルにlogin_idカラムを追加しました';
END $$;

