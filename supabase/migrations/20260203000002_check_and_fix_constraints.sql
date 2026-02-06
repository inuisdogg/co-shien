-- =============================================
-- users テーブルの CHECK 制約を完全に修正
-- 既存の全ての role 関連制約を削除して再作成
-- =============================================

-- まず、users テーブルの role カラムに関する全ての CHECK 制約を削除
DO $$
DECLARE
    constraint_rec RECORD;
BEGIN
    -- pg_constraint から users テーブルの CHECK 制約を検索
    FOR constraint_rec IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE rel.relname = 'users'
          AND nsp.nspname = 'public'
          AND con.contype = 'c'  -- CHECK 制約
          AND pg_get_constraintdef(con.oid) LIKE '%role%'
    LOOP
        RAISE NOTICE 'Dropping constraint: %', constraint_rec.conname;
        EXECUTE format('ALTER TABLE users DROP CONSTRAINT IF EXISTS %I', constraint_rec.conname);
    END LOOP;
END $$;

-- user_type 関連の制約も削除
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
        RAISE NOTICE 'Dropping constraint: %', constraint_rec.conname;
        EXECUTE format('ALTER TABLE users DROP CONSTRAINT IF EXISTS %I', constraint_rec.conname);
    END LOOP;
END $$;

-- 新しい制約を作成（owner を含む）
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IS NULL OR role IN ('owner', 'admin', 'manager', 'staff', 'client'));

ALTER TABLE users ADD CONSTRAINT users_user_type_check
  CHECK (user_type IS NULL OR user_type IN ('owner', 'staff', 'client'));

-- 確認用のログ出力
DO $$
DECLARE
    constraint_rec RECORD;
BEGIN
    RAISE NOTICE '=== Current CHECK constraints on users table ===';
    FOR constraint_rec IN
        SELECT con.conname, pg_get_constraintdef(con.oid) as def
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE rel.relname = 'users'
          AND nsp.nspname = 'public'
          AND con.contype = 'c'
    LOOP
        RAISE NOTICE 'Constraint: % - %', constraint_rec.conname, constraint_rec.def;
    END LOOP;
END $$;
