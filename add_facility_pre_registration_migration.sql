-- 施設の事前登録機能のためのマイグレーション
-- 1. facilitiesテーブルにpre_registeredカラムを追加
-- 2. facility_contractsテーブルを作成（契約情報）
-- 3. facility_registration_tokensテーブルを作成（特設ページ用トークン）

-- 1. facilitiesテーブルにpre_registeredカラムを追加
ALTER TABLE facilities 
ADD COLUMN IF NOT EXISTS pre_registered BOOLEAN DEFAULT FALSE;

-- インデックスを追加
CREATE INDEX IF NOT EXISTS idx_facilities_pre_registered ON facilities(pre_registered);

-- 2. facility_contractsテーブルを作成（契約情報）
CREATE TABLE IF NOT EXISTS facility_contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  facility_id TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  amount NUMERIC(10, 2), -- 契約金額
  contact_person_name TEXT, -- 担当者名
  contact_person_email TEXT, -- 担当者メールアドレス
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE
);

-- インデックスを追加
CREATE INDEX IF NOT EXISTS idx_facility_contracts_facility_id ON facility_contracts(facility_id);

-- 3. facility_registration_tokensテーブルを作成（特設ページ用トークン）
CREATE TABLE IF NOT EXISTS facility_registration_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  facility_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE, -- トークン（一意）
  expires_at TIMESTAMPTZ NOT NULL, -- 有効期限
  used_at TIMESTAMPTZ, -- 使用日時（使用されたら記録）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE
);

-- インデックスを追加
CREATE INDEX IF NOT EXISTS idx_facility_registration_tokens_facility_id ON facility_registration_tokens(facility_id);
CREATE INDEX IF NOT EXISTS idx_facility_registration_tokens_token ON facility_registration_tokens(token);
CREATE INDEX IF NOT EXISTS idx_facility_registration_tokens_expires_at ON facility_registration_tokens(expires_at);

-- コメントを追加
COMMENT ON TABLE facility_contracts IS '施設の契約情報を保存するテーブル';
COMMENT ON TABLE facility_registration_tokens IS '施設作成用の特設ページトークンを管理するテーブル';
COMMENT ON COLUMN facilities.pre_registered IS '事前登録された施設かどうか（true: 事前登録、false: 通常登録）';

