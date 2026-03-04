-- 指定申請書類管理機能のDBマイグレーション
-- 協力医療機関テーブル、指定情報フィールド、チェックリストテーブルを追加

-- ============================================
-- 1-A. cooperative_medical_institutions テーブル（新規）
-- 協力医療機関を管理する専用テーブル（しおり(18)対応）
-- ============================================
CREATE TABLE IF NOT EXISTS cooperative_medical_institutions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  institution_name TEXT NOT NULL,
  department TEXT,
  doctor_name TEXT,
  address TEXT,
  phone TEXT,
  travel_time_minutes INT,
  agreement_file_url TEXT,
  agreement_file_name TEXT,
  agreement_date DATE,
  agreement_expiry_date DATE,
  notes TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cmi_facility ON cooperative_medical_institutions(facility_id);

-- ============================================
-- 1-B. facilities テーブル — 指定情報フィールド追加
-- ============================================
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS designation_date DATE;
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS designation_expiry_date DATE;
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS designated_service_types JSONB DEFAULT '[]';

-- ============================================
-- 1-C. facility_settings — 指定申請関連フィールド追加
-- ============================================
ALTER TABLE facility_settings ADD COLUMN IF NOT EXISTS social_insurance_status JSONB DEFAULT '{}';
ALTER TABLE facility_settings ADD COLUMN IF NOT EXISTS earthquake_resistance JSONB DEFAULT '{}';
ALTER TABLE facility_settings ADD COLUMN IF NOT EXISTS complaint_resolution JSONB DEFAULT '{}';
ALTER TABLE facility_settings ADD COLUMN IF NOT EXISTS primary_disability_types JSONB DEFAULT '[]';

-- ============================================
-- 1-D. designation_checklist テーブル（新規）
-- 24書類の提出状況を管理
-- ============================================
CREATE TABLE IF NOT EXISTS designation_checklist (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  document_number INT NOT NULL,
  document_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'uploaded', 'verified')),
  file_url TEXT,
  file_name TEXT,
  notes TEXT,
  linked_feature TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT,
  UNIQUE(facility_id, document_number)
);

CREATE INDEX IF NOT EXISTS idx_designation_checklist_facility ON designation_checklist(facility_id);

-- ============================================
-- RLS ポリシー
-- ============================================
ALTER TABLE cooperative_medical_institutions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'cooperative_medical_institutions' AND policyname = 'cmi_select_policy'
  ) THEN
    CREATE POLICY cmi_select_policy ON cooperative_medical_institutions FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'cooperative_medical_institutions' AND policyname = 'cmi_insert_policy'
  ) THEN
    CREATE POLICY cmi_insert_policy ON cooperative_medical_institutions FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'cooperative_medical_institutions' AND policyname = 'cmi_update_policy'
  ) THEN
    CREATE POLICY cmi_update_policy ON cooperative_medical_institutions FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'cooperative_medical_institutions' AND policyname = 'cmi_delete_policy'
  ) THEN
    CREATE POLICY cmi_delete_policy ON cooperative_medical_institutions FOR DELETE USING (true);
  END IF;
END $$;

ALTER TABLE designation_checklist ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'designation_checklist' AND policyname = 'dc_select_policy'
  ) THEN
    CREATE POLICY dc_select_policy ON designation_checklist FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'designation_checklist' AND policyname = 'dc_insert_policy'
  ) THEN
    CREATE POLICY dc_insert_policy ON designation_checklist FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'designation_checklist' AND policyname = 'dc_update_policy'
  ) THEN
    CREATE POLICY dc_update_policy ON designation_checklist FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'designation_checklist' AND policyname = 'dc_delete_policy'
  ) THEN
    CREATE POLICY dc_delete_policy ON designation_checklist FOR DELETE USING (true);
  END IF;
END $$;
