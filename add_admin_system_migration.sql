-- ============================================
-- 管理者システム追加マイグレーション
-- ============================================
-- 施設、管理者、マネージャー、スタッフの階層構造を実装

-- ============================================
-- 1. 施設テーブル
-- ============================================
CREATE TABLE IF NOT EXISTS facilities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. ユーザーテーブル（管理者・マネージャー・スタッフ）
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'staff')),
  password_hash TEXT,
  has_account BOOLEAN DEFAULT false,
  -- 権限設定（マネージャーとスタッフ用、JSONB形式）
  -- 例: {"dashboard": true, "management": false, "lead": true, "schedule": true, "children": true, "staff": true, "facility": true}
  permissions JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(facility_id, name)
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_users_facility_id ON users(facility_id);
CREATE INDEX IF NOT EXISTS idx_users_facility_name ON users(facility_id, name) WHERE has_account = true;
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ============================================
-- 3. 既存のstaffテーブルとの連携
-- ============================================
-- staffテーブルにuser_idカラムを追加（既存のスタッフとユーザーアカウントを紐付ける）
ALTER TABLE staff ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE SET NULL;

-- ============================================
-- 更新日時の自動更新トリガー
-- ============================================
CREATE TRIGGER update_facilities_updated_at BEFORE UPDATE ON facilities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 完了メッセージ
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '管理者システムのマイグレーションが完了しました！';
  RAISE NOTICE '作成されたテーブル:';
  RAISE NOTICE '  - facilities';
  RAISE NOTICE '  - users';
END $$;



