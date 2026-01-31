-- =============================================
-- 公式規定・制度管理テーブル
-- 就業規則、賃金規定、福利厚生などのPDF文書を管理
-- =============================================

-- 規定カテゴリマスタ
CREATE TABLE IF NOT EXISTS regulation_categories (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  code TEXT NOT NULL,              -- 'employment_rules', 'salary', 'benefits', 'other'
  name TEXT NOT NULL,              -- '就業規則', '賃金・報酬', '福利厚生', 'その他'
  icon TEXT,                       -- Lucide icon name
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(facility_id, code)
);

-- 規定文書テーブル
CREATE TABLE IF NOT EXISTS company_regulations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,

  -- 基本情報
  title TEXT NOT NULL,             -- '就業規則（本則）'
  description TEXT,                -- 概要説明
  category_code TEXT NOT NULL,     -- 'employment_rules', 'salary', etc.

  -- ファイル情報
  file_url TEXT NOT NULL,          -- ストレージURL
  file_name TEXT NOT NULL,         -- 'employment_rules_2024.pdf'
  file_size INTEGER DEFAULT 0,     -- バイト数
  file_type TEXT DEFAULT 'pdf',    -- 'pdf', 'docx', etc.

  -- PDF検索用テキスト（将来拡張用）
  extracted_text TEXT,             -- PDFから抽出したテキスト

  -- メタデータ
  version TEXT,                    -- 'v1.0', '2024年1月版'
  effective_date DATE,             -- 施行日
  revision_date DATE,              -- 改定日

  -- 表示設定
  is_published BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,

  -- 監査情報
  uploaded_by TEXT REFERENCES users(id),
  uploaded_by_name TEXT,
  view_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 規定の閲覧履歴（誰がいつ閲覧したか）
CREATE TABLE IF NOT EXISTS regulation_views (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  regulation_id TEXT NOT NULL REFERENCES company_regulations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(regulation_id, user_id)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_company_regulations_facility ON company_regulations(facility_id);
CREATE INDEX IF NOT EXISTS idx_company_regulations_category ON company_regulations(facility_id, category_code);
-- 検索用のインデックス（ILIKE検索の高速化のため）
CREATE INDEX IF NOT EXISTS idx_company_regulations_title ON company_regulations(title);
CREATE INDEX IF NOT EXISTS idx_regulation_categories_facility ON regulation_categories(facility_id);
CREATE INDEX IF NOT EXISTS idx_regulation_views_regulation ON regulation_views(regulation_id);
CREATE INDEX IF NOT EXISTS idx_regulation_views_user ON regulation_views(user_id);

-- RLSポリシー
ALTER TABLE regulation_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_regulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE regulation_views ENABLE ROW LEVEL SECURITY;

-- カテゴリ: 施設メンバーが閲覧可能
CREATE POLICY "regulation_categories_select" ON regulation_categories
  FOR SELECT USING (true);

CREATE POLICY "regulation_categories_insert" ON regulation_categories
  FOR INSERT WITH CHECK (true);

CREATE POLICY "regulation_categories_update" ON regulation_categories
  FOR UPDATE USING (true);

CREATE POLICY "regulation_categories_delete" ON regulation_categories
  FOR DELETE USING (true);

-- 規定文書: 施設メンバーが閲覧可能
CREATE POLICY "company_regulations_select" ON company_regulations
  FOR SELECT USING (true);

CREATE POLICY "company_regulations_insert" ON company_regulations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "company_regulations_update" ON company_regulations
  FOR UPDATE USING (true);

CREATE POLICY "company_regulations_delete" ON company_regulations
  FOR DELETE USING (true);

-- 閲覧履歴
CREATE POLICY "regulation_views_select" ON regulation_views
  FOR SELECT USING (true);

CREATE POLICY "regulation_views_insert" ON regulation_views
  FOR INSERT WITH CHECK (true);

CREATE POLICY "regulation_views_update" ON regulation_views
  FOR UPDATE USING (true);

-- デフォルトカテゴリを挿入する関数
CREATE OR REPLACE FUNCTION insert_default_regulation_categories(p_facility_id TEXT)
RETURNS void AS $$
BEGIN
  INSERT INTO regulation_categories (facility_id, code, name, icon, display_order)
  VALUES
    (p_facility_id, 'employment_rules', '就業規則', 'FileText', 1),
    (p_facility_id, 'salary', '賃金・報酬', 'Wallet', 2),
    (p_facility_id, 'benefits', '福利厚生', 'Heart', 3),
    (p_facility_id, 'safety', '安全衛生', 'Shield', 4),
    (p_facility_id, 'other', 'その他規定', 'FolderOpen', 5)
  ON CONFLICT (facility_id, code) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- 閲覧数インクリメント関数
CREATE OR REPLACE FUNCTION increment_regulation_view_count(p_regulation_id TEXT)
RETURNS void AS $$
BEGIN
  UPDATE company_regulations
  SET view_count = view_count + 1
  WHERE id = p_regulation_id;
END;
$$ LANGUAGE plpgsql;

-- コメント
COMMENT ON TABLE regulation_categories IS '規定カテゴリマスタ（施設ごと）';
COMMENT ON TABLE company_regulations IS '公式規定・制度文書（PDF等）';
COMMENT ON TABLE regulation_views IS '規定文書の閲覧履歴';
COMMENT ON COLUMN company_regulations.extracted_text IS 'PDFから抽出したテキスト（全文検索用）';
