-- ============================================
-- 労務管理テーブル: 36協定管理
-- ============================================

CREATE TABLE IF NOT EXISTS overtime_agreements (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL,
  fiscal_year INTEGER NOT NULL,
  monthly_limit_hours NUMERIC(5,1) DEFAULT 45,
  annual_limit_hours NUMERIC(6,1) DEFAULT 360,
  special_monthly_limit NUMERIC(5,1) DEFAULT 100,
  special_months_limit INTEGER DEFAULT 6,
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(facility_id, fiscal_year)
);

ALTER TABLE overtime_agreements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "overtime_agreements_all" ON overtime_agreements FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_overtime_agreements_facility ON overtime_agreements(facility_id);
CREATE INDEX IF NOT EXISTS idx_overtime_agreements_fiscal_year ON overtime_agreements(fiscal_year);

COMMENT ON TABLE overtime_agreements IS '36協定設定テーブル';
COMMENT ON COLUMN overtime_agreements.monthly_limit_hours IS '月間残業上限時間（デフォルト45時間）';
COMMENT ON COLUMN overtime_agreements.annual_limit_hours IS '年間残業上限時間（デフォルト360時間）';
COMMENT ON COLUMN overtime_agreements.special_monthly_limit IS '特別条項月間上限（デフォルト100時間）';
COMMENT ON COLUMN overtime_agreements.special_months_limit IS '特別条項適用可能月数（デフォルト6ヶ月）';
