-- 施設レベルの招待リンク（メール招待用）
CREATE TABLE IF NOT EXISTS facility_invite_links (
  id TEXT PRIMARY KEY DEFAULT ('fil-' || substr(md5(random()::text), 1, 12)),
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  max_uses INT,
  use_count INT NOT NULL DEFAULT 0,
  default_role TEXT NOT NULL DEFAULT '一般スタッフ',
  default_employment_type TEXT NOT NULL DEFAULT '常勤',
  expires_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE facility_invite_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "facility_invite_links_all" ON facility_invite_links
  FOR ALL USING (true) WITH CHECK (true);

-- 一括インポートバッチ（進捗追跡）
CREATE TABLE IF NOT EXISTS bulk_import_batches (
  id TEXT PRIMARY KEY DEFAULT ('bib-' || substr(md5(random()::text), 1, 12)),
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  import_type TEXT NOT NULL CHECK (import_type IN ('full', 'minimal')),
  total_rows INT NOT NULL DEFAULT 0,
  success_count INT NOT NULL DEFAULT 0,
  error_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  error_details JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE bulk_import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bulk_import_batches_all" ON bulk_import_batches
  FOR ALL USING (true) WITH CHECK (true);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_facility_invite_links_facility ON facility_invite_links(facility_id);
CREATE INDEX IF NOT EXISTS idx_facility_invite_links_code ON facility_invite_links(code);
CREATE INDEX IF NOT EXISTS idx_bulk_import_batches_facility ON bulk_import_batches(facility_id);
