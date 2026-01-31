-- ============================================
-- 人員配置コンプライアンス管理システム
-- Personnel Staffing Compliance Management
-- ============================================

-- ============================================
-- 1. スタッフ人員設定テーブル
-- Staff Personnel Settings
-- ============================================
CREATE TABLE IF NOT EXISTS staff_personnel_settings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,

  -- 人員区分 (Personnel Classification)
  -- standard = 基準人員, addition = 加算人員
  personnel_type TEXT NOT NULL DEFAULT 'standard'
    CHECK (personnel_type IN ('standard', 'addition')),

  -- 勤務形態 (Work Style)
  -- fulltime_dedicated = 常勤専従
  -- fulltime_concurrent = 常勤兼務
  -- parttime = 非常勤
  work_style TEXT NOT NULL DEFAULT 'fulltime_dedicated'
    CHECK (work_style IN ('fulltime_dedicated', 'fulltime_concurrent', 'parttime')),

  -- 特殊役割 (Special Roles)
  is_manager BOOLEAN DEFAULT FALSE,              -- 管理者フラグ
  is_service_manager BOOLEAN DEFAULT FALSE,      -- 児童発達支援管理責任者フラグ
  manager_concurrent_role TEXT,                  -- 管理者の兼務役割

  -- 週所定労働時間 (Contracted Weekly Hours)
  contracted_weekly_hours NUMERIC(4,1),

  -- 加算配置 (Addition Assignment)
  assigned_addition_codes TEXT[],                -- 配置先加算コード配列

  -- 有効期間 (Effective Period)
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,

  -- メタデータ
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(facility_id, staff_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_personnel_facility ON staff_personnel_settings(facility_id);
CREATE INDEX IF NOT EXISTS idx_staff_personnel_staff ON staff_personnel_settings(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_personnel_type ON staff_personnel_settings(personnel_type);
CREATE INDEX IF NOT EXISTS idx_staff_personnel_work_style ON staff_personnel_settings(work_style);

COMMENT ON TABLE staff_personnel_settings IS 'スタッフの人員区分・勤務形態設定';
COMMENT ON COLUMN staff_personnel_settings.personnel_type IS '人員区分: standard=基準人員, addition=加算人員';
COMMENT ON COLUMN staff_personnel_settings.work_style IS '勤務形態: fulltime_dedicated=常勤専従, fulltime_concurrent=常勤兼務, parttime=非常勤';
COMMENT ON COLUMN staff_personnel_settings.is_manager IS '管理者フラグ（兼務可）';
COMMENT ON COLUMN staff_personnel_settings.is_service_manager IS '児童発達支援管理責任者フラグ（兼務不可）';

-- ============================================
-- 2. 日次コンプライアンス記録テーブル
-- Daily Staffing Compliance Records
-- ============================================
CREATE TABLE IF NOT EXISTS daily_staffing_compliance (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  date DATE NOT NULL,

  -- 総合判定 (Overall Status)
  overall_status TEXT NOT NULL DEFAULT 'compliant'
    CHECK (overall_status IN ('compliant', 'warning', 'non_compliant')),

  -- 基準人員チェック (Base Staff Requirements)
  has_two_staff BOOLEAN DEFAULT FALSE,           -- 2名配置済み
  has_fulltime_dedicated BOOLEAN DEFAULT FALSE,  -- 常勤専従1名配置済み
  has_second_staff BOOLEAN DEFAULT FALSE,        -- 2人目（常勤または常勤換算1.0）配置済み
  fte_total NUMERIC(4,2) DEFAULT 0,              -- 常勤換算合計

  -- 管理者・児発管チェック (Manager/Service Manager)
  has_manager BOOLEAN DEFAULT FALSE,             -- 管理者配置済み
  has_service_manager BOOLEAN DEFAULT FALSE,     -- 児発管配置済み

  -- 人数内訳 (Staff Count Breakdown)
  scheduled_staff_count INTEGER DEFAULT 0,       -- シフト登録スタッフ総数
  standard_staff_count INTEGER DEFAULT 0,        -- 基準人員数
  addition_staff_count INTEGER DEFAULT 0,        -- 加算人員数

  -- 加算別コンプライアンス (Addition-specific Compliance)
  -- { "addition_code": { "met": true/false, "reason": "説明" } }
  addition_compliance JSONB DEFAULT '{}',

  -- スタッフ内訳 (Staff Breakdown Detail)
  -- [{ "staffId", "name", "personnelType", "workStyle", "scheduledHours", "fte", "qualifications", "assignedAdditions" }]
  staff_breakdown JSONB DEFAULT '[]',

  -- 警告一覧 (Warnings)
  -- [{ "type", "message", "severity" }]
  warnings JSONB DEFAULT '[]',

  -- 計算メタデータ
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

COMMENT ON TABLE daily_staffing_compliance IS '日次人員配置コンプライアンス記録';
COMMENT ON COLUMN daily_staffing_compliance.overall_status IS '総合判定: compliant=充足, warning=注意, non_compliant=不足';

-- ============================================
-- 3. 施設設定拡張
-- Facility Settings Extension
-- ============================================
ALTER TABLE facility_settings
  ADD COLUMN IF NOT EXISTS standard_weekly_hours NUMERIC(4,1) DEFAULT 40.0,
  ADD COLUMN IF NOT EXISTS manager_staff_id TEXT,
  ADD COLUMN IF NOT EXISTS service_manager_staff_id TEXT;

COMMENT ON COLUMN facility_settings.standard_weekly_hours IS '週あたり所定労働時間（常勤の基準）';
COMMENT ON COLUMN facility_settings.manager_staff_id IS '管理者のスタッフID';
COMMENT ON COLUMN facility_settings.service_manager_staff_id IS '児発管のスタッフID';

-- ============================================
-- 4. 加算スタッフ要件マスタ
-- Addition Staff Requirements Master
-- ============================================
CREATE TABLE IF NOT EXISTS addition_staff_requirements (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  addition_code TEXT NOT NULL,

  -- 必要資格 (Required Qualifications)
  required_qualifications TEXT[],                -- 資格コード配列
  any_qualification BOOLEAN DEFAULT FALSE,       -- true=いずれかの資格でOK

  -- 経験要件 (Experience Requirements)
  min_years_experience INTEGER,                  -- 最低経験年数

  -- 勤務形態要件 (Work Style Requirements)
  required_work_style TEXT,                      -- 必要な勤務形態
  min_fte NUMERIC(3,2),                          -- 最低FTE

  -- 人数要件 (Count Requirements)
  min_staff_count INTEGER DEFAULT 1,             -- 最低人数

  -- 追加条件 (Additional Conditions)
  additional_conditions JSONB,

  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(addition_code)
);

CREATE INDEX IF NOT EXISTS idx_addition_requirements_code ON addition_staff_requirements(addition_code);

COMMENT ON TABLE addition_staff_requirements IS '加算ごとのスタッフ配置要件マスタ';

-- 主要加算の要件を初期投入
INSERT INTO addition_staff_requirements (addition_code, required_qualifications, any_qualification, min_years_experience, required_work_style, min_fte, description) VALUES
  -- 児童指導員等加配加算（常勤専従）
  ('staff_allocation_1_fulltime',
   ARRAY['PT','OT','ST','NURSERY_TEACHER','CHILD_INSTRUCTOR','PSYCHOLOGIST'],
   true, 5, 'fulltime_dedicated', 1.0,
   '児童指導員等加配加算I（常勤専従）: 経験5年以上、常勤専従1.0人以上'),

  -- 児童指導員等加配加算（常勤換算）
  ('staff_allocation_1_convert',
   ARRAY['PT','OT','ST','NURSERY_TEACHER','CHILD_INSTRUCTOR','PSYCHOLOGIST'],
   true, 5, NULL, 1.0,
   '児童指導員等加配加算I（常勤換算）: 経験5年以上、常勤換算1.0人以上'),

  -- 専門的支援体制加算
  ('specialist_support_structure',
   ARRAY['PT','OT','ST','PSYCHOLOGIST','VISION_TRAINER'],
   true, NULL, NULL, NULL,
   '専門的支援体制加算: PT/OT/ST/公認心理師/視能訓練士のいずれかを配置'),

  -- 福祉専門職員配置等加算I
  ('welfare_specialist_1',
   ARRAY['SOCIAL_WORKER','CARE_WORKER','PSYCH_WELFARE_WORKER'],
   true, NULL, NULL, NULL,
   '福祉専門職員配置等加算I: 社会福祉士/介護福祉士/精神保健福祉士が35%以上'),

  -- 看護職員配置加算
  ('nursing_staff',
   ARRAY['NURSE','PUBLIC_HEALTH_NURSE'],
   true, NULL, NULL, NULL,
   '看護職員配置加算: 看護師または保健師を配置')
ON CONFLICT (addition_code) DO NOTHING;

-- ============================================
-- 5. 勤務体制一覧表履歴
-- Work Schedule Reports
-- ============================================
CREATE TABLE IF NOT EXISTS work_schedule_reports (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,

  -- 対象期間 (Report Period)
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),

  -- 報告内容 (Report Content - denormalized for audit)
  -- [{ "staffId", "name", "personnelType", "workStyle", "qualifications", "weeklyHours", "fte", "assignedAdditions", "role" }]
  staff_assignments JSONB NOT NULL,

  -- 集計 (Summary)
  total_standard_staff INTEGER,
  total_addition_staff INTEGER,
  fte_total NUMERIC(4,2),

  -- 報告ステータス (Report Status)
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved')),

  -- 提出追跡 (Submission Tracking)
  generated_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  submitted_to TEXT,                             -- 提出先（行政機関名）
  approved_at TIMESTAMPTZ,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(facility_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_work_schedule_reports_facility ON work_schedule_reports(facility_id);
CREATE INDEX IF NOT EXISTS idx_work_schedule_reports_period ON work_schedule_reports(year, month);

COMMENT ON TABLE work_schedule_reports IS '勤務体制一覧表（行政提出用）';

-- ============================================
-- 6. RLSポリシー設定
-- Row Level Security Policies
-- ============================================
ALTER TABLE staff_personnel_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_staffing_compliance ENABLE ROW LEVEL SECURITY;
ALTER TABLE addition_staff_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_schedule_reports ENABLE ROW LEVEL SECURITY;

-- staff_personnel_settings RLS
DROP POLICY IF EXISTS "staff_personnel_select" ON staff_personnel_settings;
CREATE POLICY "staff_personnel_select" ON staff_personnel_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "staff_personnel_insert" ON staff_personnel_settings;
CREATE POLICY "staff_personnel_insert" ON staff_personnel_settings FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "staff_personnel_update" ON staff_personnel_settings;
CREATE POLICY "staff_personnel_update" ON staff_personnel_settings FOR UPDATE USING (true);

DROP POLICY IF EXISTS "staff_personnel_delete" ON staff_personnel_settings;
CREATE POLICY "staff_personnel_delete" ON staff_personnel_settings FOR DELETE USING (true);

-- daily_staffing_compliance RLS
DROP POLICY IF EXISTS "daily_compliance_select" ON daily_staffing_compliance;
CREATE POLICY "daily_compliance_select" ON daily_staffing_compliance FOR SELECT USING (true);

DROP POLICY IF EXISTS "daily_compliance_insert" ON daily_staffing_compliance;
CREATE POLICY "daily_compliance_insert" ON daily_staffing_compliance FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "daily_compliance_update" ON daily_staffing_compliance;
CREATE POLICY "daily_compliance_update" ON daily_staffing_compliance FOR UPDATE USING (true);

DROP POLICY IF EXISTS "daily_compliance_delete" ON daily_staffing_compliance;
CREATE POLICY "daily_compliance_delete" ON daily_staffing_compliance FOR DELETE USING (true);

-- addition_staff_requirements RLS (read-only for most users)
DROP POLICY IF EXISTS "addition_requirements_select" ON addition_staff_requirements;
CREATE POLICY "addition_requirements_select" ON addition_staff_requirements FOR SELECT USING (true);

DROP POLICY IF EXISTS "addition_requirements_insert" ON addition_staff_requirements;
CREATE POLICY "addition_requirements_insert" ON addition_staff_requirements FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "addition_requirements_update" ON addition_staff_requirements;
CREATE POLICY "addition_requirements_update" ON addition_staff_requirements FOR UPDATE USING (true);

-- work_schedule_reports RLS
DROP POLICY IF EXISTS "work_schedule_reports_select" ON work_schedule_reports;
CREATE POLICY "work_schedule_reports_select" ON work_schedule_reports FOR SELECT USING (true);

DROP POLICY IF EXISTS "work_schedule_reports_insert" ON work_schedule_reports;
CREATE POLICY "work_schedule_reports_insert" ON work_schedule_reports FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "work_schedule_reports_update" ON work_schedule_reports;
CREATE POLICY "work_schedule_reports_update" ON work_schedule_reports FOR UPDATE USING (true);

DROP POLICY IF EXISTS "work_schedule_reports_delete" ON work_schedule_reports;
CREATE POLICY "work_schedule_reports_delete" ON work_schedule_reports FOR DELETE USING (true);

-- ============================================
-- 7. 更新トリガー
-- Update Triggers
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
