-- ============================================
-- 人員配置関連テーブルの作成とRLSポリシー設定
-- テーブルが存在しない場合は作成し、RLSポリシーを適切に設定
-- ============================================

-- ============================================
-- 1. スタッフ人員設定テーブル
-- ============================================
CREATE TABLE IF NOT EXISTS staff_personnel_settings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  personnel_type TEXT NOT NULL DEFAULT 'standard'
    CHECK (personnel_type IN ('standard', 'addition')),
  work_style TEXT NOT NULL DEFAULT 'fulltime_dedicated'
    CHECK (work_style IN ('fulltime_dedicated', 'fulltime_concurrent', 'parttime')),
  is_manager BOOLEAN DEFAULT FALSE,
  is_service_manager BOOLEAN DEFAULT FALSE,
  manager_concurrent_role TEXT,
  contracted_weekly_hours NUMERIC(4,1),
  assigned_addition_codes TEXT[],
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(facility_id, staff_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_personnel_facility ON staff_personnel_settings(facility_id);
CREATE INDEX IF NOT EXISTS idx_staff_personnel_staff ON staff_personnel_settings(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_personnel_type ON staff_personnel_settings(personnel_type);
CREATE INDEX IF NOT EXISTS idx_staff_personnel_work_style ON staff_personnel_settings(work_style);

-- ============================================
-- 2. 日次コンプライアンス記録テーブル
-- ============================================
CREATE TABLE IF NOT EXISTS daily_staffing_compliance (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  overall_status TEXT NOT NULL DEFAULT 'compliant'
    CHECK (overall_status IN ('compliant', 'warning', 'non_compliant')),
  has_two_staff BOOLEAN DEFAULT FALSE,
  has_fulltime_dedicated BOOLEAN DEFAULT FALSE,
  has_second_staff BOOLEAN DEFAULT FALSE,
  fte_total NUMERIC(4,2) DEFAULT 0,
  has_manager BOOLEAN DEFAULT FALSE,
  has_service_manager BOOLEAN DEFAULT FALSE,
  scheduled_staff_count INTEGER DEFAULT 0,
  standard_staff_count INTEGER DEFAULT 0,
  addition_staff_count INTEGER DEFAULT 0,
  addition_compliance JSONB DEFAULT '{}',
  staff_breakdown JSONB DEFAULT '[]',
  warnings JSONB DEFAULT '[]',
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  calculated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(facility_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_compliance_facility ON daily_staffing_compliance(facility_id);
CREATE INDEX IF NOT EXISTS idx_daily_compliance_date ON daily_staffing_compliance(date);
CREATE INDEX IF NOT EXISTS idx_daily_compliance_status ON daily_staffing_compliance(overall_status);
CREATE INDEX IF NOT EXISTS idx_daily_compliance_facility_date ON daily_staffing_compliance(facility_id, date);

-- ============================================
-- 3. 加算スタッフ要件マスタ
-- ============================================
CREATE TABLE IF NOT EXISTS addition_staff_requirements (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  addition_code TEXT NOT NULL,
  required_qualifications TEXT[],
  any_qualification BOOLEAN DEFAULT FALSE,
  min_years_experience INTEGER,
  required_work_style TEXT,
  min_fte NUMERIC(3,2),
  min_staff_count INTEGER DEFAULT 1,
  additional_conditions JSONB,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(addition_code)
);

CREATE INDEX IF NOT EXISTS idx_addition_requirements_code ON addition_staff_requirements(addition_code);

-- ============================================
-- 4. 勤務体制一覧表
-- ============================================
CREATE TABLE IF NOT EXISTS work_schedule_reports (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  staff_assignments JSONB NOT NULL,
  total_standard_staff INTEGER,
  total_addition_staff INTEGER,
  fte_total NUMERIC(4,2),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved')),
  generated_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  submitted_to TEXT,
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(facility_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_work_schedule_reports_facility ON work_schedule_reports(facility_id);
CREATE INDEX IF NOT EXISTS idx_work_schedule_reports_period ON work_schedule_reports(year, month);

-- ============================================
-- 5. RLS有効化
-- ============================================
ALTER TABLE staff_personnel_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_staffing_compliance ENABLE ROW LEVEL SECURITY;
ALTER TABLE addition_staff_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_schedule_reports ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. staff_personnel_settings RLSポリシー
-- ============================================
DROP POLICY IF EXISTS "staff_personnel_select" ON staff_personnel_settings;
DROP POLICY IF EXISTS "staff_personnel_select_v2" ON staff_personnel_settings;
CREATE POLICY "staff_personnel_select_v2" ON staff_personnel_settings
FOR SELECT USING (
  facility_id IN (
    SELECT s.facility_id FROM staff s
    WHERE s.user_id = auth.uid()::TEXT
  )
);

DROP POLICY IF EXISTS "staff_personnel_insert" ON staff_personnel_settings;
DROP POLICY IF EXISTS "staff_personnel_insert_v2" ON staff_personnel_settings;
CREATE POLICY "staff_personnel_insert_v2" ON staff_personnel_settings
FOR INSERT WITH CHECK (
  facility_id IN (
    SELECT s.facility_id FROM staff s
    WHERE s.user_id = auth.uid()::TEXT
  )
);

DROP POLICY IF EXISTS "staff_personnel_update" ON staff_personnel_settings;
DROP POLICY IF EXISTS "staff_personnel_update_v2" ON staff_personnel_settings;
CREATE POLICY "staff_personnel_update_v2" ON staff_personnel_settings
FOR UPDATE USING (
  facility_id IN (
    SELECT s.facility_id FROM staff s
    WHERE s.user_id = auth.uid()::TEXT
  )
);

DROP POLICY IF EXISTS "staff_personnel_delete" ON staff_personnel_settings;
DROP POLICY IF EXISTS "staff_personnel_delete_v2" ON staff_personnel_settings;
CREATE POLICY "staff_personnel_delete_v2" ON staff_personnel_settings
FOR DELETE USING (
  facility_id IN (
    SELECT s.facility_id FROM staff s
    WHERE s.user_id = auth.uid()::TEXT
  )
);

-- ============================================
-- 7. daily_staffing_compliance RLSポリシー
-- ============================================
DROP POLICY IF EXISTS "daily_compliance_select" ON daily_staffing_compliance;
DROP POLICY IF EXISTS "daily_compliance_select_v2" ON daily_staffing_compliance;
CREATE POLICY "daily_compliance_select_v2" ON daily_staffing_compliance
FOR SELECT USING (
  facility_id IN (
    SELECT s.facility_id FROM staff s
    WHERE s.user_id = auth.uid()::TEXT
  )
);

DROP POLICY IF EXISTS "daily_compliance_insert" ON daily_staffing_compliance;
DROP POLICY IF EXISTS "daily_compliance_insert_v2" ON daily_staffing_compliance;
CREATE POLICY "daily_compliance_insert_v2" ON daily_staffing_compliance
FOR INSERT WITH CHECK (
  facility_id IN (
    SELECT s.facility_id FROM staff s
    WHERE s.user_id = auth.uid()::TEXT
  )
);

DROP POLICY IF EXISTS "daily_compliance_update" ON daily_staffing_compliance;
DROP POLICY IF EXISTS "daily_compliance_update_v2" ON daily_staffing_compliance;
CREATE POLICY "daily_compliance_update_v2" ON daily_staffing_compliance
FOR UPDATE USING (
  facility_id IN (
    SELECT s.facility_id FROM staff s
    WHERE s.user_id = auth.uid()::TEXT
  )
);

DROP POLICY IF EXISTS "daily_compliance_delete" ON daily_staffing_compliance;
DROP POLICY IF EXISTS "daily_compliance_delete_v2" ON daily_staffing_compliance;
CREATE POLICY "daily_compliance_delete_v2" ON daily_staffing_compliance
FOR DELETE USING (
  facility_id IN (
    SELECT s.facility_id FROM staff s
    WHERE s.user_id = auth.uid()::TEXT
  )
);

-- ============================================
-- 8. work_schedule_reports RLSポリシー
-- ============================================
DROP POLICY IF EXISTS "work_schedule_reports_select" ON work_schedule_reports;
DROP POLICY IF EXISTS "work_schedule_reports_select_v2" ON work_schedule_reports;
CREATE POLICY "work_schedule_reports_select_v2" ON work_schedule_reports
FOR SELECT USING (
  facility_id IN (
    SELECT s.facility_id FROM staff s
    WHERE s.user_id = auth.uid()::TEXT
  )
);

DROP POLICY IF EXISTS "work_schedule_reports_insert" ON work_schedule_reports;
DROP POLICY IF EXISTS "work_schedule_reports_insert_v2" ON work_schedule_reports;
CREATE POLICY "work_schedule_reports_insert_v2" ON work_schedule_reports
FOR INSERT WITH CHECK (
  facility_id IN (
    SELECT s.facility_id FROM staff s
    WHERE s.user_id = auth.uid()::TEXT
  )
);

DROP POLICY IF EXISTS "work_schedule_reports_update" ON work_schedule_reports;
DROP POLICY IF EXISTS "work_schedule_reports_update_v2" ON work_schedule_reports;
CREATE POLICY "work_schedule_reports_update_v2" ON work_schedule_reports
FOR UPDATE USING (
  facility_id IN (
    SELECT s.facility_id FROM staff s
    WHERE s.user_id = auth.uid()::TEXT
  )
);

DROP POLICY IF EXISTS "work_schedule_reports_delete" ON work_schedule_reports;
DROP POLICY IF EXISTS "work_schedule_reports_delete_v2" ON work_schedule_reports;
CREATE POLICY "work_schedule_reports_delete_v2" ON work_schedule_reports
FOR DELETE USING (
  facility_id IN (
    SELECT s.facility_id FROM staff s
    WHERE s.user_id = auth.uid()::TEXT
  )
);

-- ============================================
-- 9. addition_staff_requirements RLSポリシー（読み取り専用）
-- ============================================
DROP POLICY IF EXISTS "addition_requirements_select" ON addition_staff_requirements;
CREATE POLICY "addition_requirements_select" ON addition_staff_requirements FOR SELECT USING (true);

DROP POLICY IF EXISTS "addition_requirements_insert" ON addition_staff_requirements;
CREATE POLICY "addition_requirements_insert" ON addition_staff_requirements FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "addition_requirements_update" ON addition_staff_requirements;
CREATE POLICY "addition_requirements_update" ON addition_staff_requirements FOR UPDATE USING (true);

-- ============================================
-- 10. 加算要件の初期データ
-- ============================================
INSERT INTO addition_staff_requirements (addition_code, required_qualifications, any_qualification, min_years_experience, required_work_style, min_fte, description) VALUES
  ('staff_allocation_1_fulltime',
   ARRAY['PT','OT','ST','NURSERY_TEACHER','CHILD_INSTRUCTOR','PSYCHOLOGIST'],
   true, 5, 'fulltime_dedicated', 1.0,
   '児童指導員等加配加算I（常勤専従）: 経験5年以上、常勤専従1.0人以上'),
  ('staff_allocation_1_convert',
   ARRAY['PT','OT','ST','NURSERY_TEACHER','CHILD_INSTRUCTOR','PSYCHOLOGIST'],
   true, 5, NULL, 1.0,
   '児童指導員等加配加算I（常勤換算）: 経験5年以上、常勤換算1.0人以上'),
  ('specialist_support_structure',
   ARRAY['PT','OT','ST','PSYCHOLOGIST','VISION_TRAINER'],
   true, NULL, NULL, NULL,
   '専門的支援体制加算: PT/OT/ST/公認心理師/視能訓練士のいずれかを配置'),
  ('welfare_specialist_1',
   ARRAY['SOCIAL_WORKER','CARE_WORKER','PSYCH_WELFARE_WORKER'],
   true, NULL, NULL, NULL,
   '福祉専門職員配置等加算I: 社会福祉士/介護福祉士/精神保健福祉士が35%以上'),
  ('nursing_staff',
   ARRAY['NURSE','PUBLIC_HEALTH_NURSE'],
   true, NULL, NULL, NULL,
   '看護職員配置加算: 看護師または保健師を配置')
ON CONFLICT (addition_code) DO NOTHING;

-- ============================================
-- 11. 更新トリガー
-- ============================================
CREATE OR REPLACE FUNCTION update_staff_personnel_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS staff_personnel_settings_updated_at ON staff_personnel_settings;
CREATE TRIGGER staff_personnel_settings_updated_at
  BEFORE UPDATE ON staff_personnel_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_staff_personnel_settings_updated_at();

CREATE OR REPLACE FUNCTION update_daily_staffing_compliance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS daily_staffing_compliance_updated_at ON daily_staffing_compliance;
CREATE TRIGGER daily_staffing_compliance_updated_at
  BEFORE UPDATE ON daily_staffing_compliance
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_staffing_compliance_updated_at();

CREATE OR REPLACE FUNCTION update_work_schedule_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS work_schedule_reports_updated_at ON work_schedule_reports;
CREATE TRIGGER work_schedule_reports_updated_at
  BEFORE UPDATE ON work_schedule_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_work_schedule_reports_updated_at();
