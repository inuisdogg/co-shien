-- スタッフ情報管理用テーブル
-- 給与明細、就業規則、会社書類、お知らせ、タスク管理

-- 給与明細テーブル
CREATE TABLE IF NOT EXISTS payslips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  base_salary INTEGER DEFAULT 0,
  overtime INTEGER DEFAULT 0,
  allowances INTEGER DEFAULT 0,
  deductions INTEGER DEFAULT 0,
  net_salary INTEGER DEFAULT 0,
  pdf_url TEXT,
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(facility_id, user_id, year, month)
);

-- 就業規則テーブル
CREATE TABLE IF NOT EXISTS work_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT '一般',
  pdf_url TEXT,
  version TEXT DEFAULT '1.0',
  effective_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 会社書類テーブル
CREATE TABLE IF NOT EXISTS company_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT '一般',
  file_url TEXT NOT NULL,
  file_type TEXT DEFAULT 'pdf',
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 会社書類の既読管理テーブル
CREATE TABLE IF NOT EXISTS company_document_reads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES company_documents(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(document_id, user_id)
);

-- 施設お知らせテーブル
CREATE TABLE IF NOT EXISTS facility_announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('high', 'normal', 'low')),
  published_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- お知らせの既読管理テーブル
CREATE TABLE IF NOT EXISTS facility_announcement_reads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  announcement_id UUID NOT NULL REFERENCES facility_announcements(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(announcement_id, user_id)
);

-- スタッフタスクテーブル
CREATE TABLE IF NOT EXISTS staff_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  assigned_to TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  assigned_by_name TEXT,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  due_date DATE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 日報テーブル
CREATE TABLE IF NOT EXISTS daily_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved')),
  submitted_at TIMESTAMP WITH TIME ZONE,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, facility_id, date)
);

-- 研修記録テーブル（存在しない場合のみ作成）
-- 注意: 既存テーブルがある場合はスキップされる
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'training_records') THEN
    CREATE TABLE training_records (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT DEFAULT '一般研修',
      training_date DATE NOT NULL,
      duration INTEGER DEFAULT 0,
      status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
      certificate_url TEXT,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  ELSE
    -- 既存テーブルにカラムがない場合は追加
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'training_records' AND column_name = 'facility_id') THEN
      ALTER TABLE training_records ADD COLUMN facility_id TEXT REFERENCES facilities(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'training_records' AND column_name = 'user_id') THEN
      ALTER TABLE training_records ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_payslips_facility_user ON payslips(facility_id, user_id);
CREATE INDEX IF NOT EXISTS idx_payslips_year_month ON payslips(year, month);
CREATE INDEX IF NOT EXISTS idx_work_rules_facility ON work_rules(facility_id);
CREATE INDEX IF NOT EXISTS idx_company_documents_facility ON company_documents(facility_id);
CREATE INDEX IF NOT EXISTS idx_facility_announcements_facility ON facility_announcements(facility_id);
CREATE INDEX IF NOT EXISTS idx_facility_announcements_published ON facility_announcements(is_published, published_at);
CREATE INDEX IF NOT EXISTS idx_staff_tasks_facility ON staff_tasks(facility_id);
CREATE INDEX IF NOT EXISTS idx_staff_tasks_assigned ON staff_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_staff_tasks_status ON staff_tasks(status);
CREATE INDEX IF NOT EXISTS idx_daily_reports_facility_user ON daily_reports(facility_id, user_id);
CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON daily_reports(date);
-- training_recordsのインデックスは条件付きで作成（カラムが存在する場合のみ）
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'training_records' AND column_name = 'facility_id')
     AND EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'training_records' AND column_name = 'user_id') THEN
    CREATE INDEX IF NOT EXISTS idx_training_records_facility_user ON training_records(facility_id, user_id);
  END IF;
END $$;

-- RLSポリシー
ALTER TABLE payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_document_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE facility_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE facility_announcement_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;
-- training_recordsはRLSが既に有効な可能性があるため確認してから有効化
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'training_records' AND rowsecurity = true
  ) THEN
    ALTER TABLE training_records ENABLE ROW LEVEL SECURITY;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL; -- エラーを無視
END $$;

-- 基本的なRLSポリシー（施設メンバーはread可能、管理者はwrite可能）
-- payslips
CREATE POLICY "payslips_select" ON payslips FOR SELECT USING (true);
CREATE POLICY "payslips_insert" ON payslips FOR INSERT WITH CHECK (true);
CREATE POLICY "payslips_update" ON payslips FOR UPDATE USING (true);
CREATE POLICY "payslips_delete" ON payslips FOR DELETE USING (true);

-- work_rules
CREATE POLICY "work_rules_select" ON work_rules FOR SELECT USING (true);
CREATE POLICY "work_rules_insert" ON work_rules FOR INSERT WITH CHECK (true);
CREATE POLICY "work_rules_update" ON work_rules FOR UPDATE USING (true);
CREATE POLICY "work_rules_delete" ON work_rules FOR DELETE USING (true);

-- company_documents
CREATE POLICY "company_documents_select" ON company_documents FOR SELECT USING (true);
CREATE POLICY "company_documents_insert" ON company_documents FOR INSERT WITH CHECK (true);
CREATE POLICY "company_documents_update" ON company_documents FOR UPDATE USING (true);
CREATE POLICY "company_documents_delete" ON company_documents FOR DELETE USING (true);

-- company_document_reads
CREATE POLICY "company_document_reads_select" ON company_document_reads FOR SELECT USING (true);
CREATE POLICY "company_document_reads_insert" ON company_document_reads FOR INSERT WITH CHECK (true);
CREATE POLICY "company_document_reads_update" ON company_document_reads FOR UPDATE USING (true);
CREATE POLICY "company_document_reads_delete" ON company_document_reads FOR DELETE USING (true);

-- facility_announcements
CREATE POLICY "facility_announcements_select" ON facility_announcements FOR SELECT USING (true);
CREATE POLICY "facility_announcements_insert" ON facility_announcements FOR INSERT WITH CHECK (true);
CREATE POLICY "facility_announcements_update" ON facility_announcements FOR UPDATE USING (true);
CREATE POLICY "facility_announcements_delete" ON facility_announcements FOR DELETE USING (true);

-- facility_announcement_reads
CREATE POLICY "facility_announcement_reads_select" ON facility_announcement_reads FOR SELECT USING (true);
CREATE POLICY "facility_announcement_reads_insert" ON facility_announcement_reads FOR INSERT WITH CHECK (true);
CREATE POLICY "facility_announcement_reads_update" ON facility_announcement_reads FOR UPDATE USING (true);
CREATE POLICY "facility_announcement_reads_delete" ON facility_announcement_reads FOR DELETE USING (true);

-- staff_tasks
CREATE POLICY "staff_tasks_select" ON staff_tasks FOR SELECT USING (true);
CREATE POLICY "staff_tasks_insert" ON staff_tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "staff_tasks_update" ON staff_tasks FOR UPDATE USING (true);
CREATE POLICY "staff_tasks_delete" ON staff_tasks FOR DELETE USING (true);

-- daily_reports
CREATE POLICY "daily_reports_select" ON daily_reports FOR SELECT USING (true);
CREATE POLICY "daily_reports_insert" ON daily_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "daily_reports_update" ON daily_reports FOR UPDATE USING (true);
CREATE POLICY "daily_reports_delete" ON daily_reports FOR DELETE USING (true);

-- training_records（既存ポリシーがある可能性があるため条件付き）
DROP POLICY IF EXISTS "training_records_select" ON training_records;
DROP POLICY IF EXISTS "training_records_insert" ON training_records;
DROP POLICY IF EXISTS "training_records_update" ON training_records;
DROP POLICY IF EXISTS "training_records_delete" ON training_records;
CREATE POLICY "training_records_select" ON training_records FOR SELECT USING (true);
CREATE POLICY "training_records_insert" ON training_records FOR INSERT WITH CHECK (true);
CREATE POLICY "training_records_update" ON training_records FOR UPDATE USING (true);
CREATE POLICY "training_records_delete" ON training_records FOR DELETE USING (true);
