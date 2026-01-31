-- =====================================================
-- ナレッジベース（社内Wiki）テーブル
-- Knowledge Base Tables
-- =====================================================

-- ナレッジ記事テーブル
CREATE TABLE IF NOT EXISTS knowledge_articles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,

  -- コンテンツ
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',      -- Markdown形式
  summary TEXT,                          -- 一覧表示用の要約（自動生成 or 手動）

  -- 分類
  category TEXT NOT NULL DEFAULT 'other', -- 'labor', 'manual', 'facility', 'knowhow', 'qa', 'other'
  tags TEXT[] DEFAULT '{}',

  -- 権限・公開設定
  is_admin_locked BOOLEAN DEFAULT FALSE,  -- true: 管理者のみ編集可能
  is_published BOOLEAN DEFAULT TRUE,      -- 公開状態
  is_pinned BOOLEAN DEFAULT FALSE,        -- トップにピン留め

  -- 添付ファイル
  attachments JSONB DEFAULT '[]',         -- [{url, name, type, size}]

  -- 作成者情報
  author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  author_name TEXT,
  last_editor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  last_editor_name TEXT,

  -- 統計
  view_count INTEGER DEFAULT 0,

  -- タイムスタンプ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- カスタムカテゴリテーブル（施設ごとに追加可能）
CREATE TABLE IF NOT EXISTS knowledge_categories (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  code TEXT NOT NULL,                     -- 'labor', 'manual', etc.
  name TEXT NOT NULL,                     -- '労務・制度'
  icon TEXT DEFAULT 'FileText',           -- Lucide icon name
  color TEXT DEFAULT '#6B7280',           -- hex color
  display_order INTEGER DEFAULT 0,
  is_default BOOLEAN DEFAULT FALSE,       -- デフォルトカテゴリかどうか
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(facility_id, code)
);

-- 記事の閲覧履歴（view_count更新用）
CREATE TABLE IF NOT EXISTS knowledge_article_views (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  article_id TEXT NOT NULL REFERENCES knowledge_articles(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(article_id, user_id)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_facility
  ON knowledge_articles(facility_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_category
  ON knowledge_articles(facility_id, category);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_published
  ON knowledge_articles(facility_id, is_published);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_pinned
  ON knowledge_articles(facility_id, is_pinned DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_search
  ON knowledge_articles USING gin(to_tsvector('simple', title || ' ' || COALESCE(content, '')));

CREATE INDEX IF NOT EXISTS idx_knowledge_categories_facility
  ON knowledge_categories(facility_id, display_order);

CREATE INDEX IF NOT EXISTS idx_knowledge_article_views_article
  ON knowledge_article_views(article_id);

-- RLS ポリシー
ALTER TABLE knowledge_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_article_views ENABLE ROW LEVEL SECURITY;

-- knowledge_articles: 施設に所属するユーザーのみアクセス可能
CREATE POLICY "knowledge_articles_facility_policy" ON knowledge_articles
  FOR ALL USING (
    facility_id IN (
      SELECT facility_id FROM users WHERE id = auth.uid()::text
    )
  );

-- knowledge_categories: 施設に所属するユーザーのみアクセス可能
CREATE POLICY "knowledge_categories_facility_policy" ON knowledge_categories
  FOR ALL USING (
    facility_id IN (
      SELECT facility_id FROM users WHERE id = auth.uid()::text
    )
  );

-- knowledge_article_views: 自分の閲覧履歴のみアクセス可能
CREATE POLICY "knowledge_article_views_user_policy" ON knowledge_article_views
  FOR ALL USING (user_id = auth.uid()::text);

-- トリガー: updated_at自動更新
CREATE OR REPLACE FUNCTION update_knowledge_article_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER knowledge_articles_updated_at
  BEFORE UPDATE ON knowledge_articles
  FOR EACH ROW
  EXECUTE FUNCTION update_knowledge_article_updated_at();

-- =====================================================
-- 初期データ投入: デフォルトカテゴリ
-- =====================================================

-- 施設ごとにデフォルトカテゴリを作成する関数
CREATE OR REPLACE FUNCTION create_default_knowledge_categories(p_facility_id TEXT)
RETURNS void AS $$
BEGIN
  INSERT INTO knowledge_categories (facility_id, code, name, icon, color, display_order, is_default)
  VALUES
    (p_facility_id, 'labor', '労務・制度', 'Scale', '#3B82F6', 1, true),
    (p_facility_id, 'manual', '業務マニュアル', 'BookOpen', '#10B981', 2, true),
    (p_facility_id, 'facility', '施設情報', 'Building2', '#8B5CF6', 3, true),
    (p_facility_id, 'knowhow', '療育ノウハウ', 'Lightbulb', '#F59E0B', 4, true),
    (p_facility_id, 'qa', 'Q&A', 'HelpCircle', '#EC4899', 5, true),
    (p_facility_id, 'other', 'その他', 'FileText', '#6B7280', 99, true)
  ON CONFLICT (facility_id, code) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- コメント追加
COMMENT ON TABLE knowledge_articles IS 'ナレッジベース記事 - 施設ごとの社内Wiki';
COMMENT ON TABLE knowledge_categories IS 'ナレッジカテゴリ - 記事の分類';
COMMENT ON TABLE knowledge_article_views IS '記事閲覧履歴 - 閲覧数カウント用';
COMMENT ON COLUMN knowledge_articles.is_admin_locked IS 'true: 管理者のみ編集可能（公式ルール）、false: 誰でも編集可能（現場ナレッジ）';
