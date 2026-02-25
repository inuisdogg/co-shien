-- =============================================================================
-- Talent Management System for 処遇改善加算
-- タレントマネジメント・処遇改善加算管理テーブル
-- =============================================================================

-- 職位・等級マスタ
CREATE TABLE IF NOT EXISTS job_grades (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  facility_id TEXT NOT NULL REFERENCES facilities(id),
  grade_name TEXT NOT NULL,
  grade_level INTEGER NOT NULL,
  responsibilities TEXT,
  appointment_requirements TEXT,
  min_salary NUMERIC,
  max_salary NUMERIC,
  required_experience_years INTEGER,
  required_qualifications TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 処遇改善計画
CREATE TABLE IF NOT EXISTS treatment_improvement_plans (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  facility_id TEXT NOT NULL REFERENCES facilities(id),
  fiscal_year INTEGER NOT NULL,
  addition_level TEXT NOT NULL CHECK (addition_level IN ('I','II','III','IV')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','active','completed')),
  estimated_annual_revenue NUMERIC,
  estimated_addition_amount NUMERIC,
  planned_improvement_total NUMERIC,
  planned_monthly_improvement NUMERIC,
  monthly_requirement_ratio NUMERIC,
  plan_submitted_at TIMESTAMPTZ,
  performance_report_submitted_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(facility_id, fiscal_year)
);

-- キャリアパス要件充足状況
CREATE TABLE IF NOT EXISTS career_path_requirements (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  plan_id TEXT NOT NULL REFERENCES treatment_improvement_plans(id) ON DELETE CASCADE,
  requirement_level TEXT NOT NULL CHECK (requirement_level IN ('I','II','III','IV','V')),
  is_met BOOLEAN DEFAULT FALSE,
  evidence_description TEXT,
  document_urls TEXT[],
  target_staff_id TEXT REFERENCES users(id),
  annual_salary_amount NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plan_id, requirement_level)
);

-- 職場環境等要件 (28 items)
CREATE TABLE IF NOT EXISTS workplace_environment_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  plan_id TEXT NOT NULL REFERENCES treatment_improvement_plans(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  item_number INTEGER NOT NULL,
  item_title TEXT NOT NULL,
  is_implemented BOOLEAN DEFAULT FALSE,
  implementation_details TEXT,
  evidence_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plan_id, item_number)
);

-- 賃金改善実績 (per staff per month)
CREATE TABLE IF NOT EXISTS wage_improvement_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  plan_id TEXT NOT NULL REFERENCES treatment_improvement_plans(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  base_salary NUMERIC DEFAULT 0,
  allowances NUMERIC DEFAULT 0,
  bonus NUMERIC DEFAULT 0,
  total_compensation NUMERIC DEFAULT 0,
  improvement_amount NUMERIC DEFAULT 0,
  employment_type TEXT,
  fte_ratio NUMERIC DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plan_id, user_id, month)
);

-- キャリア開発記録 (個人の経年蓄積)
CREATE TABLE IF NOT EXISTS career_development_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id),
  facility_id TEXT NOT NULL REFERENCES facilities(id),
  record_type TEXT NOT NULL CHECK (record_type IN ('promotion','raise','training','qualification','evaluation','milestone')),
  title TEXT NOT NULL,
  description TEXT,
  recorded_date DATE NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies
ALTER TABLE job_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_improvement_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_path_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE workplace_environment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE wage_improvement_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_development_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_grades_all" ON job_grades FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "tip_all" ON treatment_improvement_plans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "cpr_all" ON career_path_requirements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "wei_all" ON workplace_environment_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "wir_all" ON wage_improvement_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "cdr_all" ON career_development_records FOR ALL USING (true) WITH CHECK (true);
