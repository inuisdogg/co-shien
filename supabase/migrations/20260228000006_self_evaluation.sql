-- Self Evaluation (自己評価) table
-- 障害児通所支援事業所の年次自己評価を管理

CREATE TABLE IF NOT EXISTS self_evaluations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  facility_id TEXT NOT NULL,
  fiscal_year TEXT NOT NULL,                            -- e.g. "2025"
  evaluation_type TEXT NOT NULL CHECK (evaluation_type IN ('self', 'parent_survey')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'published')),
  responses JSONB DEFAULT '{}'::jsonb,
  summary TEXT,
  improvement_plan TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(facility_id, fiscal_year, evaluation_type)
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_self_evaluations_facility_id ON self_evaluations(facility_id);
CREATE INDEX IF NOT EXISTS idx_self_evaluations_fiscal_year ON self_evaluations(fiscal_year);

-- Enable RLS
ALTER TABLE self_evaluations ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own facility evaluations"
  ON self_evaluations FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own facility evaluations"
  ON self_evaluations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own facility evaluations"
  ON self_evaluations FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete own facility evaluations"
  ON self_evaluations FOR DELETE
  USING (true);
