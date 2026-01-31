-- 個別支援計画PDFファイル管理テーブル
-- 児童ごとにPDFファイルをアップロードして管理
-- 定期的な更新（6ヶ月ごとなど）に対応

CREATE TABLE IF NOT EXISTS support_plan_files (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,

  -- 計画の種別
  plan_type TEXT NOT NULL DEFAULT 'renewal' CHECK (plan_type IN (
    'initial',      -- 初回作成
    'renewal',      -- 更新（定期）
    'modification'  -- 変更（随時）
  )),

  -- 計画の期間
  period_start DATE NOT NULL,           -- 計画開始日
  period_end DATE NOT NULL,             -- 計画終了日

  -- 作成情報
  plan_created_date DATE NOT NULL,      -- 計画作成日
  plan_creator_name TEXT,               -- 作成者名（児発管など）

  -- ファイル情報
  file_path TEXT,                       -- Supabase Storage内のパス
  file_name TEXT NOT NULL,              -- 元のファイル名
  file_size INTEGER,                    -- ファイルサイズ（バイト）

  -- 同意・署名情報
  parent_agreed BOOLEAN DEFAULT false,  -- 保護者同意済み
  parent_agreed_at TIMESTAMPTZ,         -- 保護者同意日時
  parent_signer_name TEXT,              -- 同意した保護者名

  -- 評価
  mid_evaluation_date DATE,             -- 中間評価実施日
  mid_evaluation_note TEXT,             -- 中間評価メモ
  final_evaluation_date DATE,           -- 最終評価実施日
  final_evaluation_note TEXT,           -- 最終評価メモ

  -- ステータス
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'draft',      -- 下書き（アップロード済み、未確定）
    'active',     -- 有効（現在の計画）
    'completed',  -- 完了（期間終了、評価済み）
    'archived'    -- アーカイブ（過去の計画）
  )),

  -- 次回更新予定
  next_renewal_date DATE,               -- 次回更新予定日
  renewal_reminder_sent BOOLEAN DEFAULT false, -- リマインダー送信済み

  -- 備考
  notes TEXT,

  -- メタデータ
  uploaded_by TEXT REFERENCES users(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_spf_facility ON support_plan_files(facility_id);
CREATE INDEX idx_spf_child ON support_plan_files(child_id);
CREATE INDEX idx_spf_status ON support_plan_files(status);
CREATE INDEX idx_spf_period ON support_plan_files(period_start, period_end);
CREATE INDEX idx_spf_renewal ON support_plan_files(next_renewal_date) WHERE status = 'active';

-- RLSポリシー
ALTER TABLE support_plan_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_plan_files_select" ON support_plan_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "support_plan_files_insert" ON support_plan_files FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "support_plan_files_update" ON support_plan_files FOR UPDATE TO authenticated USING (true);
CREATE POLICY "support_plan_files_delete" ON support_plan_files FOR DELETE TO authenticated USING (true);

-- 更新日時を自動更新するトリガー
CREATE OR REPLACE FUNCTION update_support_plan_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_support_plan_files_updated_at
  BEFORE UPDATE ON support_plan_files
  FOR EACH ROW
  EXECUTE FUNCTION update_support_plan_files_updated_at();

COMMENT ON TABLE support_plan_files IS '個別支援計画PDFファイル管理テーブル。児童ごとにPDFをアップロードして履歴管理する。';
COMMENT ON COLUMN support_plan_files.plan_type IS '計画種別: initial=初回作成, renewal=更新（定期）, modification=変更（随時）';
COMMENT ON COLUMN support_plan_files.period_start IS '計画の適用開始日';
COMMENT ON COLUMN support_plan_files.period_end IS '計画の適用終了日（通常6ヶ月後）';
COMMENT ON COLUMN support_plan_files.plan_created_date IS '計画を作成した日付';
COMMENT ON COLUMN support_plan_files.next_renewal_date IS '次回更新予定日（リマインダー用）';
