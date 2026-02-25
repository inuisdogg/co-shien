-- 個別支援計画テーブルの確認と拡張
-- plan_content JSONB列で、アセスメント・目標・支援内容・評価を格納

-- テーブルが存在しない場合は作成
CREATE TABLE IF NOT EXISTS support_plan_files (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL,
  child_id TEXT NOT NULL,
  plan_type TEXT NOT NULL DEFAULT 'renewal',
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  plan_created_date DATE NOT NULL,
  plan_creator_name TEXT,
  file_path TEXT,
  file_name TEXT,
  file_size INTEGER,
  parent_agreed BOOLEAN DEFAULT false,
  parent_agreed_at TIMESTAMPTZ,
  parent_signer_name TEXT,
  mid_evaluation_date DATE,
  mid_evaluation_note TEXT,
  final_evaluation_date DATE,
  final_evaluation_note TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  next_renewal_date DATE,
  renewal_reminder_sent BOOLEAN DEFAULT false,
  notes TEXT,
  uploaded_by TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- plan_content列を追加（5領域対応）
ALTER TABLE support_plan_files
  ADD COLUMN IF NOT EXISTS plan_content JSONB DEFAULT '{}';

-- RLS有効化（冪等）
ALTER TABLE support_plan_files ENABLE ROW LEVEL SECURITY;

-- RLSポリシー（冪等）
DO $$ BEGIN
  CREATE POLICY "support_plan_files_select" ON support_plan_files FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "support_plan_files_insert" ON support_plan_files FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "support_plan_files_update" ON support_plan_files FOR UPDATE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "support_plan_files_delete" ON support_plan_files FOR DELETE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN support_plan_files.plan_content IS '個別支援計画の詳細コンテンツ（5領域対応）。アセスメント・目標・支援内容・評価をJSON形式で格納。';
