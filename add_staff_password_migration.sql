-- ============================================
-- スタッフテーブルにパスワードフィールドを追加
-- ============================================
-- このマイグレーションは、スタッフがログインできるようにパスワードフィールドを追加します

-- パスワードフィールドを追加（ハッシュ化されたパスワードを保存）
ALTER TABLE staff ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- パスワードが設定されているかどうかを示すフラグ（オプション）
ALTER TABLE staff ADD COLUMN IF NOT EXISTS has_account BOOLEAN DEFAULT false;

-- インデックスの追加（ログイン時の検索を高速化）
CREATE INDEX IF NOT EXISTS idx_staff_name_facility ON staff(facility_id, name) WHERE has_account = true;

-- ============================================
-- 完了メッセージ
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'スタッフテーブルにパスワードフィールドを追加しました！';
END $$;


