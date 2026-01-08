-- 企業管理と施設発行権限のためのマイグレーション
-- 1. companiesテーブルを作成（取引先企業）
-- 2. facilitiesテーブルにcompany_idとfranchise_or_independentカラムを追加
-- 3. admin_permissionsテーブルを作成（施設発行権限）

-- 1. companiesテーブルを作成（取引先企業）
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- 企業名
  contact_person_name TEXT, -- 担当者名
  contact_person_email TEXT, -- 担当者メールアドレス
  contract_start_date DATE, -- 契約開始日
  contract_end_date DATE, -- 契約終了日
  contract_amount NUMERIC(10, 2), -- 契約金額
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックスを追加
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);
CREATE INDEX IF NOT EXISTS idx_companies_contact_email ON companies(contact_person_email);

-- 2. facilitiesテーブルにcompany_idとfranchise_or_independentカラムを追加
ALTER TABLE facilities 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS franchise_or_independent TEXT CHECK (franchise_or_independent IN ('franchise', 'independent'));

-- インデックスを追加
CREATE INDEX IF NOT EXISTS idx_facilities_company_id ON facilities(company_id);

-- 3. admin_permissionsテーブルを作成（施設発行権限）
CREATE TABLE IF NOT EXISTS admin_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- パーソナルID
  permission_type TEXT NOT NULL DEFAULT 'facility_creation', -- 権限タイプ（将来的に拡張可能）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, permission_type)
);

-- インデックスを追加
CREATE INDEX IF NOT EXISTS idx_admin_permissions_user_id ON admin_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_permissions_type ON admin_permissions(permission_type);

-- コメントを追加
COMMENT ON TABLE companies IS '取引先企業情報を保存するテーブル';
COMMENT ON TABLE admin_permissions IS '施設発行権限などの管理権限を保存するテーブル';
COMMENT ON COLUMN facilities.company_id IS '所属する企業ID';
COMMENT ON COLUMN facilities.franchise_or_independent IS 'フランチャイズか独立店舗か（franchise: フランチャイズ、independent: 独立店舗）';

-- koya.htk@gmail.comに施設発行権限を付与（存在する場合）
INSERT INTO admin_permissions (user_id, permission_type)
SELECT id, 'facility_creation'
FROM users
WHERE email = 'koya.htk@gmail.com'
ON CONFLICT (user_id, permission_type) DO NOTHING;

