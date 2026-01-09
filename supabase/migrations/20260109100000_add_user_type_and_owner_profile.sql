-- 利用者アカウント主導型モデルへの移行
-- usersテーブルにuser_typeカラムを追加（スタッフと利用者の区別）
-- childrenテーブルにowner_profile_idカラムを追加（保護者との紐付け）

-- 1. usersテーブルにuser_typeカラムを追加
ALTER TABLE users
ADD COLUMN IF NOT EXISTS user_type TEXT CHECK (user_type IN ('staff', 'client')) DEFAULT 'staff';

-- 既存データは全てスタッフとして設定
UPDATE users SET user_type = 'staff' WHERE user_type IS NULL;

-- roleの制約を更新（clientを追加）
-- まず既存の制約を削除
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- 新しい制約を追加（admin, manager, staff, client）
ALTER TABLE users ADD CONSTRAINT users_role_check
CHECK (role IN ('admin', 'manager', 'staff', 'client'));

-- 2. childrenテーブルにowner_profile_idカラムを追加
ALTER TABLE children
ADD COLUMN IF NOT EXISTS owner_profile_id TEXT REFERENCES users(id);

-- 3. childrenテーブルのfacility_idをNULL許容に変更（利用者登録の児童は施設未紐付け）
ALTER TABLE children
ALTER COLUMN facility_id DROP NOT NULL;

-- 4. インデックスの作成
CREATE INDEX IF NOT EXISTS idx_users_user_type ON users(user_type);
CREATE INDEX IF NOT EXISTS idx_children_owner_profile_id ON children(owner_profile_id);

-- 5. コメント追加（ドキュメント用）
COMMENT ON COLUMN users.user_type IS 'ユーザー種別: staff=スタッフ, client=利用者（保護者）';
COMMENT ON COLUMN children.owner_profile_id IS '所有者（保護者）のユーザーID。施設登録の場合はNULL';
