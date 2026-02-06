-- =============================================
-- オーナーロール/タイプの追加
-- プラットフォームオーナー登録を可能にする
-- =============================================

-- 1. users.role の CHECK 制約を更新（owner を追加）
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('owner', 'admin', 'manager', 'staff', 'client'));

-- 2. users.user_type の CHECK 制約を更新（owner を追加）
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_user_type_check;
ALTER TABLE users ADD CONSTRAINT users_user_type_check
  CHECK (user_type IN ('owner', 'staff', 'client'));

-- 3. RLSポリシーの更新（system_config テーブル）
-- オーナーのみが system_config を更新できるようにする

-- 既存ポリシーを削除して再作成
DROP POLICY IF EXISTS "system_config_update" ON system_config;
DROP POLICY IF EXISTS "system_config_insert" ON system_config;

-- オーナー未設定時 または オーナーのみ更新可能
CREATE POLICY "system_config_update" ON system_config
  FOR UPDATE USING (
    -- オーナーが存在しない場合は誰でも更新可能（初期セットアップ用）
    NOT EXISTS (SELECT 1 FROM users WHERE role = 'owner')
    OR
    -- オーナーが存在する場合は認証ユーザーがオーナーである必要がある
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()::TEXT
      AND role = 'owner'
    )
  );

-- 同様にINSERTも制限
CREATE POLICY "system_config_insert" ON system_config
  FOR INSERT WITH CHECK (
    NOT EXISTS (SELECT 1 FROM users WHERE role = 'owner')
    OR
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()::TEXT
      AND role = 'owner'
    )
  );

-- 4. users テーブルの RLS ポリシーを調整
-- オーナーは最初のユーザーとして登録できるようにする
DROP POLICY IF EXISTS "users_insert_policy" ON users;
DROP POLICY IF EXISTS "users_insert" ON users;

-- 認証済みユーザー または オーナー未設定時は INSERT 可能
CREATE POLICY "users_insert_policy" ON users
  FOR INSERT WITH CHECK (
    -- 最初のユーザー（オーナー）登録を許可
    NOT EXISTS (SELECT 1 FROM users WHERE role = 'owner')
    OR
    -- 認証済みユーザーは INSERT 可能
    auth.uid() IS NOT NULL
  );

-- コメント
COMMENT ON CONSTRAINT users_role_check ON users IS 'ユーザーロール: owner=プラットフォームオーナー, admin=施設管理者, manager=マネージャー, staff=スタッフ, client=利用者';
COMMENT ON CONSTRAINT users_user_type_check ON users IS 'ユーザー種別: owner=プラットフォームオーナー, staff=スタッフ, client=利用者';
