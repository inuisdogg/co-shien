-- =====================================================
-- 加算マスタのバージョン管理システム
-- 法改正による単位数・条件変更の履歴を保持
-- =====================================================

-- 1. 法改正履歴テーブル
CREATE TABLE IF NOT EXISTS law_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_date DATE NOT NULL,                    -- 適用日（例: 2024-04-01）
  name TEXT NOT NULL,                             -- 改正名（例: 令和6年度障害福祉サービス等報酬改定）
  description TEXT,                               -- 概要説明
  source_url TEXT,                                -- 厚労省等の出典URL
  is_active BOOLEAN DEFAULT true,                 -- 有効フラグ
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 初期データ：令和6年度改定（現行）
INSERT INTO law_revisions (id, revision_date, name, description, is_active)
VALUES (
  'a0000001-0000-0000-0000-000000000001',
  '2024-04-01',
  '令和6年度障害福祉サービス等報酬改定',
  '障害児通所支援の報酬改定。基本報酬の見直し、各種加算の新設・改廃等。',
  true
);

-- 2. 加算バージョンテーブル（変更されやすい情報を分離）
CREATE TABLE IF NOT EXISTS addition_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  addition_id TEXT NOT NULL REFERENCES additions(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,      -- バージョン番号

  -- 単位数関連（法改正で変わりやすい）
  units INTEGER,                                  -- 単位数
  is_percentage BOOLEAN DEFAULT false,            -- 割合加算かどうか
  percentage_rate NUMERIC(5,2),                   -- 割合（%）

  -- 算定条件（法改正で変わりやすい）
  requirements TEXT,                              -- 算定要件（テキスト）
  requirements_json JSONB,                        -- 算定要件（構造化データ）
  max_times_per_month INTEGER,                    -- 月間上限回数
  max_times_per_day INTEGER,                      -- 日次上限回数

  -- 適用期間
  effective_from DATE NOT NULL,                   -- 適用開始日
  effective_to DATE,                              -- 適用終了日（NULLは現在有効）

  -- 法改正との関連
  revision_id UUID REFERENCES law_revisions(id),  -- どの法改正に基づくか

  -- メタ情報
  notes TEXT,                                     -- 変更メモ
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,                                -- 作成者

  -- ユニーク制約
  UNIQUE(addition_id, version_number)
);

-- インデックス（日付での検索を高速化）
CREATE INDEX IF NOT EXISTS idx_addition_versions_effective
  ON addition_versions(addition_id, effective_from, effective_to);

CREATE INDEX IF NOT EXISTS idx_addition_versions_revision
  ON addition_versions(revision_id);

-- 3. 既存データを初期バージョンとして移行
INSERT INTO addition_versions (
  addition_id,
  version_number,
  units,
  is_percentage,
  percentage_rate,
  requirements,
  requirements_json,
  max_times_per_month,
  max_times_per_day,
  effective_from,
  effective_to,
  revision_id,
  notes
)
SELECT
  id,
  1,  -- 初期バージョン
  units,
  is_percentage,
  percentage_rate,
  requirements,
  requirements_json,
  max_times_per_month,
  max_times_per_day,
  COALESCE(effective_from, '2024-04-01'),  -- 令和6年度改定の適用日
  NULL,  -- 現在有効
  'a0000001-0000-0000-0000-000000000001',  -- 令和6年度改定
  '初期データ移行'
FROM additions
WHERE id IS NOT NULL
ON CONFLICT (addition_id, version_number) DO NOTHING;

-- 4. 特定日時点の有効バージョンを取得するビュー
CREATE OR REPLACE VIEW addition_versions_current AS
SELECT
  av.*,
  a.code,
  a.name,
  a.short_name,
  a.category_code,
  a.addition_type,
  a.applicable_services,
  a.is_exclusive,
  a.exclusive_with,
  a.is_active,
  a.display_order
FROM addition_versions av
JOIN additions a ON a.id = av.addition_id
WHERE av.effective_to IS NULL
  OR av.effective_to >= CURRENT_DATE;

-- 5. 更新トリガー
CREATE OR REPLACE FUNCTION update_addition_versions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_addition_versions_updated_at ON addition_versions;
CREATE TRIGGER trigger_addition_versions_updated_at
  BEFORE UPDATE ON addition_versions
  FOR EACH ROW
  EXECUTE FUNCTION update_addition_versions_updated_at();

-- 6. 法改正テーブルの更新トリガー
CREATE OR REPLACE FUNCTION update_law_revisions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_law_revisions_updated_at ON law_revisions;
CREATE TRIGGER trigger_law_revisions_updated_at
  BEFORE UPDATE ON law_revisions
  FOR EACH ROW
  EXECUTE FUNCTION update_law_revisions_updated_at();

-- 7. RLSポリシー
ALTER TABLE law_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE addition_versions ENABLE ROW LEVEL SECURITY;

-- 読み取りは全員許可（マスタデータなので）
CREATE POLICY "law_revisions_read_all" ON law_revisions
  FOR SELECT USING (true);

CREATE POLICY "addition_versions_read_all" ON addition_versions
  FOR SELECT USING (true);

-- 書き込みは認証ユーザーのみ（実際は管理者のみに制限すべき）
CREATE POLICY "law_revisions_insert_authenticated" ON law_revisions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "law_revisions_update_authenticated" ON law_revisions
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "addition_versions_insert_authenticated" ON addition_versions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "addition_versions_update_authenticated" ON addition_versions
  FOR UPDATE USING (auth.role() = 'authenticated');

-- コメント
COMMENT ON TABLE law_revisions IS '法改正履歴。報酬改定などの変更を記録';
COMMENT ON TABLE addition_versions IS '加算のバージョン管理。法改正による単位数・条件の変更履歴を保持';
COMMENT ON VIEW addition_versions_current IS '現在有効な加算バージョンを取得するビュー';
