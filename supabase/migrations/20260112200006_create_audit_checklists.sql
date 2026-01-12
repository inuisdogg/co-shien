-- 運営指導チェックリストテーブル
-- 運営指導ごとに必要書類の準備状況を管理

CREATE TABLE IF NOT EXISTS audit_checklists (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,

  -- 運営指導情報
  audit_name TEXT NOT NULL, -- 運営指導名（例: 令和6年度 運営指導）
  audit_date DATE, -- 実施予定日
  audit_type TEXT CHECK (audit_type IN (
    'regular',      -- 定期
    'follow_up',    -- フォローアップ
    'complaint'     -- 苦情・事故対応
  )),

  -- チェック状況（JSON: 書類IDをキー、準備済みかどうかを値）
  -- { "doc_1": { checked: true, checkedAt: "...", checkedBy: "...", notes: "..." }, ... }
  checklist JSONB DEFAULT '{}',

  -- メモ
  notes TEXT,

  -- ステータス
  status TEXT DEFAULT 'preparing' CHECK (status IN (
    'preparing',    -- 準備中
    'ready',        -- 準備完了
    'completed',    -- 実施完了
    'archived'      -- アーカイブ
  )),

  -- メタデータ
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_audit_checklists_facility ON audit_checklists(facility_id);
CREATE INDEX IF NOT EXISTS idx_audit_checklists_date ON audit_checklists(audit_date);
CREATE INDEX IF NOT EXISTS idx_audit_checklists_status ON audit_checklists(status);

-- RLS有効化
ALTER TABLE audit_checklists ENABLE ROW LEVEL SECURITY;

-- RLSポリシー
CREATE POLICY "audit_checklists_select" ON audit_checklists FOR SELECT USING (true);
CREATE POLICY "audit_checklists_insert" ON audit_checklists FOR INSERT WITH CHECK (true);
CREATE POLICY "audit_checklists_update" ON audit_checklists FOR UPDATE USING (true);
CREATE POLICY "audit_checklists_delete" ON audit_checklists FOR DELETE USING (true);

-- コメント
COMMENT ON TABLE audit_checklists IS '運営指導チェックリスト';
COMMENT ON COLUMN audit_checklists.checklist IS '書類チェック状況（JSON）';
