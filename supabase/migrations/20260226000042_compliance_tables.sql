-- =============================================
-- 規定確認・BCP・虐待防止・資格管理テーブル
-- Agent 3: Regulations + Compliance System
-- =============================================

-- 規定確認（署名）テーブル
CREATE TABLE IF NOT EXISTS regulation_acknowledgments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  regulation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  facility_id TEXT NOT NULL,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(regulation_id, user_id)
);
ALTER TABLE regulation_acknowledgments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "regulation_acknowledgments_all" ON regulation_acknowledgments FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_reg_ack_regulation ON regulation_acknowledgments(regulation_id);
CREATE INDEX IF NOT EXISTS idx_reg_ack_user ON regulation_acknowledgments(user_id);

-- BCP計画テーブル
CREATE TABLE IF NOT EXISTS bcp_plans (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL,
  plan_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content JSONB DEFAULT '{}',
  version TEXT,
  status TEXT DEFAULT 'draft',
  last_reviewed_at TIMESTAMPTZ,
  next_review_date DATE,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE bcp_plans ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "bcp_plans_all" ON bcp_plans FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_bcp_plans_facility ON bcp_plans(facility_id);

-- BCP緊急連絡先
CREATE TABLE IF NOT EXISTS bcp_emergency_contacts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL,
  bcp_plan_id TEXT,
  contact_name TEXT NOT NULL,
  role TEXT,
  phone TEXT,
  email TEXT,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE bcp_emergency_contacts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "bcp_emergency_contacts_all" ON bcp_emergency_contacts FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 虐待防止記録テーブル
CREATE TABLE IF NOT EXISTS abuse_prevention_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL,
  record_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content JSONB DEFAULT '{}',
  date DATE,
  participants JSONB DEFAULT '[]',
  status TEXT DEFAULT 'draft',
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE abuse_prevention_records ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "abuse_prevention_all" ON abuse_prevention_records FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_abuse_prev_facility ON abuse_prevention_records(facility_id);
CREATE INDEX IF NOT EXISTS idx_abuse_prev_type ON abuse_prevention_records(record_type);

-- 資格管理テーブル
CREATE TABLE IF NOT EXISTS staff_qualifications (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT NOT NULL,
  facility_id TEXT NOT NULL,
  qualification_name TEXT NOT NULL,
  qualification_code TEXT,
  certificate_number TEXT,
  issued_date DATE,
  expiry_date DATE,
  certificate_file_url TEXT,
  certificate_file_name TEXT,
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE staff_qualifications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "staff_qualifications_all" ON staff_qualifications FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_staff_quals_user ON staff_qualifications(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_quals_expiry ON staff_qualifications(expiry_date);
CREATE INDEX IF NOT EXISTS idx_staff_quals_facility ON staff_qualifications(facility_id);

-- 運営規定カテゴリの追加（既存regulation_categoriesがある場合のみ）
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'regulation_categories') THEN
    INSERT INTO regulation_categories (id, facility_id, code, name, icon, display_order)
    SELECT gen_random_uuid()::TEXT, facility_id, 'operations', '運営規定', 'Building2', 6
    FROM regulation_categories
    WHERE code = 'employment_rules'
    ON CONFLICT (facility_id, code) DO NOTHING;
  END IF;
END $$;
