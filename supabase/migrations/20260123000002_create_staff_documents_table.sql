-- スタッフ個別書類テーブル
-- 給与明細、源泉徴収票、雇用契約書など、スタッフ個別に配信する書類を管理

CREATE TABLE IF NOT EXISTS staff_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- 書類種別
  document_type TEXT NOT NULL CHECK (document_type IN (
    'payslip',           -- 給与明細
    'withholding_tax',   -- 源泉徴収票
    'employment_contract', -- 雇用契約書
    'wage_notice',       -- 賃金通知書
    'social_insurance',  -- 社会保険関連書類
    'year_end_adjustment', -- 年末調整書類
    'other'              -- その他
  )),

  -- 書類情報
  title TEXT NOT NULL,
  description TEXT,

  -- ファイル情報
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT DEFAULT 'pdf',
  file_size INTEGER,

  -- 対象期間（給与明細・源泉徴収票など）
  target_year INTEGER,
  target_month INTEGER CHECK (target_month IS NULL OR (target_month >= 1 AND target_month <= 12)),

  -- 管理情報
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_staff_documents_facility_user ON staff_documents(facility_id, user_id);
CREATE INDEX IF NOT EXISTS idx_staff_documents_type ON staff_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_staff_documents_target_period ON staff_documents(target_year, target_month);

-- RLSポリシー
ALTER TABLE staff_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_documents_select" ON staff_documents FOR SELECT USING (true);
CREATE POLICY "staff_documents_insert" ON staff_documents FOR INSERT WITH CHECK (true);
CREATE POLICY "staff_documents_update" ON staff_documents FOR UPDATE USING (true);
CREATE POLICY "staff_documents_delete" ON staff_documents FOR DELETE USING (true);
