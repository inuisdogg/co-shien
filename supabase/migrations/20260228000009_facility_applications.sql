-- 施設申請テーブル（申請→審査→承認フロー）
CREATE TABLE IF NOT EXISTS facility_applications (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id),

  -- 法人情報
  company_name TEXT NOT NULL,
  company_type TEXT, -- 株式会社, NPO法人, 一般社団法人, 個人事業主 等
  representative_name TEXT,
  company_address TEXT,
  company_phone TEXT,

  -- 施設情報
  facility_name TEXT NOT NULL,
  service_categories JSONB DEFAULT '{}'::jsonb,
  business_number TEXT,
  postal_code TEXT,
  facility_address TEXT,
  capacity_am INTEGER,
  capacity_pm INTEGER,
  designation_file_url TEXT,

  -- 審査
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- 承認後の参照
  approved_facility_id TEXT REFERENCES facilities(id),
  approved_company_id UUID REFERENCES companies(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_facility_applications_status ON facility_applications(status);
CREATE INDEX IF NOT EXISTS idx_facility_applications_user_id ON facility_applications(user_id);

-- RLS
ALTER TABLE facility_applications ENABLE ROW LEVEL SECURITY;

-- service role用のフルアクセス（カスタムログイン方式対応）
CREATE POLICY facility_applications_service ON facility_applications
  FOR ALL USING (true) WITH CHECK (true);
