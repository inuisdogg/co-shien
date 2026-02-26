-- =============================================
-- 求人・人材紹介システム テーブル定義
-- =============================================

-- 1. job_postings（求人情報）
CREATE TABLE IF NOT EXISTS job_postings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('full_time', 'part_time', 'spot')),
  title TEXT NOT NULL,
  description TEXT,
  required_qualifications TEXT[] DEFAULT '{}',
  preferred_qualifications TEXT[] DEFAULT '{}',
  experience_years_min INT DEFAULT 0,
  employment_type TEXT, -- 常勤/非常勤/スポット
  work_location TEXT,
  work_hours TEXT,
  salary_min INT,
  salary_max INT,
  salary_type TEXT CHECK (salary_type IN ('monthly', 'hourly', 'daily', 'annual')),
  benefits TEXT,
  annual_salary_estimate INT, -- for full_time fee calculation
  spots_needed INT DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed', 'filled')),
  published_at TIMESTAMPTZ,
  closes_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. spot_work_shifts（スポットシフト）
CREATE TABLE IF NOT EXISTS spot_work_shifts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  job_posting_id TEXT NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  role_needed TEXT,
  hourly_rate INT,
  spots_available INT DEFAULT 1,
  spots_filled INT DEFAULT 0,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'filled', 'cancelled', 'completed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. job_applications（応募）
CREATE TABLE IF NOT EXISTS job_applications (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  job_posting_id TEXT NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  spot_shift_id TEXT REFERENCES spot_work_shifts(id),
  applicant_user_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'screening', 'interview_scheduled', 'interviewed', 'offer_sent', 'offer_accepted', 'hired', 'rejected', 'withdrawn')),
  cover_message TEXT,
  resume_url TEXT,
  interview_date TIMESTAMPTZ,
  interview_notes TEXT,
  facility_rating INT CHECK (facility_rating >= 1 AND facility_rating <= 5),
  facility_notes TEXT,
  hired_at TIMESTAMPTZ,
  start_date DATE,
  agreed_salary INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_posting_id, applicant_user_id)
);

-- 4. placements（成約・配置）
CREATE TABLE IF NOT EXISTS placements (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  job_application_id TEXT NOT NULL REFERENCES job_applications(id),
  facility_id TEXT NOT NULL REFERENCES facilities(id),
  worker_user_id TEXT NOT NULL REFERENCES users(id),
  job_type TEXT NOT NULL,
  agreed_salary INT NOT NULL,
  fee_rate DECIMAL(5,2) NOT NULL,
  fee_amount INT NOT NULL,
  stripe_invoice_id TEXT,
  stripe_payment_intent_id TEXT,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'invoiced', 'paid', 'overdue', 'refunded', 'cancelled')),
  paid_at TIMESTAMPTZ,
  placement_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. stripe_customers（Stripe顧客情報）
CREATE TABLE IF NOT EXISTS stripe_customers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL UNIQUE REFERENCES facilities(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL UNIQUE,
  default_payment_method TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. recruitment_messages（採用メッセージ）
CREATE TABLE IF NOT EXISTS recruitment_messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  job_application_id TEXT NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
  sender_type TEXT CHECK (sender_type IN ('facility', 'applicant')),
  sender_user_id TEXT REFERENCES users(id),
  message TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- インデックス
-- =============================================

CREATE INDEX IF NOT EXISTS idx_job_postings_facility_id ON job_postings(facility_id);
CREATE INDEX IF NOT EXISTS idx_job_postings_status ON job_postings(status);
CREATE INDEX IF NOT EXISTS idx_job_postings_job_type ON job_postings(job_type);
CREATE INDEX IF NOT EXISTS idx_spot_work_shifts_shift_date ON spot_work_shifts(shift_date);
CREATE INDEX IF NOT EXISTS idx_job_applications_applicant_user_id ON job_applications(applicant_user_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_status ON job_applications(status);
CREATE INDEX IF NOT EXISTS idx_placements_facility_id ON placements(facility_id);

-- =============================================
-- RLS 有効化
-- =============================================

ALTER TABLE job_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE spot_work_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruitment_messages ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS ポリシー（Permissive）
-- =============================================

-- job_postings: 全ユーザーが閲覧可能、施設メンバーが管理可能
CREATE POLICY "job_postings_select" ON job_postings FOR SELECT USING (true);
CREATE POLICY "job_postings_insert" ON job_postings FOR INSERT WITH CHECK (true);
CREATE POLICY "job_postings_update" ON job_postings FOR UPDATE USING (true);
CREATE POLICY "job_postings_delete" ON job_postings FOR DELETE USING (true);

-- spot_work_shifts: 全ユーザーが閲覧可能、施設メンバーが管理可能
CREATE POLICY "spot_work_shifts_select" ON spot_work_shifts FOR SELECT USING (true);
CREATE POLICY "spot_work_shifts_insert" ON spot_work_shifts FOR INSERT WITH CHECK (true);
CREATE POLICY "spot_work_shifts_update" ON spot_work_shifts FOR UPDATE USING (true);
CREATE POLICY "spot_work_shifts_delete" ON spot_work_shifts FOR DELETE USING (true);

-- job_applications: 関連ユーザーが閲覧・管理可能
CREATE POLICY "job_applications_select" ON job_applications FOR SELECT USING (true);
CREATE POLICY "job_applications_insert" ON job_applications FOR INSERT WITH CHECK (true);
CREATE POLICY "job_applications_update" ON job_applications FOR UPDATE USING (true);
CREATE POLICY "job_applications_delete" ON job_applications FOR DELETE USING (true);

-- placements: 関連ユーザーが閲覧・管理可能
CREATE POLICY "placements_select" ON placements FOR SELECT USING (true);
CREATE POLICY "placements_insert" ON placements FOR INSERT WITH CHECK (true);
CREATE POLICY "placements_update" ON placements FOR UPDATE USING (true);
CREATE POLICY "placements_delete" ON placements FOR DELETE USING (true);

-- stripe_customers: 関連施設が閲覧・管理可能
CREATE POLICY "stripe_customers_select" ON stripe_customers FOR SELECT USING (true);
CREATE POLICY "stripe_customers_insert" ON stripe_customers FOR INSERT WITH CHECK (true);
CREATE POLICY "stripe_customers_update" ON stripe_customers FOR UPDATE USING (true);
CREATE POLICY "stripe_customers_delete" ON stripe_customers FOR DELETE USING (true);

-- recruitment_messages: 関連ユーザーが閲覧・管理可能
CREATE POLICY "recruitment_messages_select" ON recruitment_messages FOR SELECT USING (true);
CREATE POLICY "recruitment_messages_insert" ON recruitment_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "recruitment_messages_update" ON recruitment_messages FOR UPDATE USING (true);
CREATE POLICY "recruitment_messages_delete" ON recruitment_messages FOR DELETE USING (true);

-- =============================================
-- updated_at トリガー
-- =============================================

CREATE OR REPLACE FUNCTION update_recruitment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_job_postings_updated_at
  BEFORE UPDATE ON job_postings
  FOR EACH ROW
  EXECUTE FUNCTION update_recruitment_updated_at();

CREATE TRIGGER set_job_applications_updated_at
  BEFORE UPDATE ON job_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_recruitment_updated_at();

CREATE TRIGGER set_placements_updated_at
  BEFORE UPDATE ON placements
  FOR EACH ROW
  EXECUTE FUNCTION update_recruitment_updated_at();
