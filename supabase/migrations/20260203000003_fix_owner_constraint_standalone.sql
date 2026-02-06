-- =============================================
-- オーナー制約修正（スタンドアロン版）
-- 他のテーブルに依存しない
-- =============================================

-- system_config テーブルを作成（存在しない場合）
CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 初期設定
INSERT INTO system_config (key, value, description) VALUES
  ('owner_setup_completed', 'false', 'プラットフォームオーナーの初期登録が完了したかどうか'),
  ('platform_name', 'co-shien', 'プラットフォーム名'),
  ('maintenance_mode', 'false', 'メンテナンスモード')
ON CONFLICT (key) DO NOTHING;

-- RLSポリシー
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_config_select" ON system_config;
CREATE POLICY "system_config_select" ON system_config FOR SELECT USING (true);

DROP POLICY IF EXISTS "system_config_insert" ON system_config;
CREATE POLICY "system_config_insert" ON system_config FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "system_config_update" ON system_config;
CREATE POLICY "system_config_update" ON system_config FOR UPDATE USING (true);

-- users テーブルの role/user_type 制約を修正
-- 全ての role 関連 CHECK 制約を削除
DO $$
DECLARE
    constraint_rec RECORD;
BEGIN
    FOR constraint_rec IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE rel.relname = 'users'
          AND nsp.nspname = 'public'
          AND con.contype = 'c'
          AND pg_get_constraintdef(con.oid) LIKE '%role%'
    LOOP
        RAISE NOTICE 'Dropping role constraint: %', constraint_rec.conname;
        EXECUTE format('ALTER TABLE users DROP CONSTRAINT IF EXISTS %I', constraint_rec.conname);
    END LOOP;
END $$;

-- 全ての user_type 関連 CHECK 制約を削除
DO $$
DECLARE
    constraint_rec RECORD;
BEGIN
    FOR constraint_rec IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE rel.relname = 'users'
          AND nsp.nspname = 'public'
          AND con.contype = 'c'
          AND pg_get_constraintdef(con.oid) LIKE '%user_type%'
    LOOP
        RAISE NOTICE 'Dropping user_type constraint: %', constraint_rec.conname;
        EXECUTE format('ALTER TABLE users DROP CONSTRAINT IF EXISTS %I', constraint_rec.conname);
    END LOOP;
END $$;

-- user_type カラムを追加（存在しない場合）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'user_type'
    ) THEN
        ALTER TABLE users ADD COLUMN user_type TEXT DEFAULT 'staff';
    END IF;
END $$;

-- 新しい制約を作成（owner を含む）
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IS NULL OR role IN ('owner', 'admin', 'manager', 'staff', 'client'));

ALTER TABLE users ADD CONSTRAINT users_user_type_check
  CHECK (user_type IS NULL OR user_type IN ('owner', 'staff', 'client'));

-- 確認
DO $$
BEGIN
    RAISE NOTICE '=== Owner constraint fix applied successfully ===';
END $$;
