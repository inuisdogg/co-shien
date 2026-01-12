-- 苦情・事故・ヒヤリハット報告テーブル
-- 運営指導で必須の「苦情処理、事故対応」関連書類の元データ

-- 報告テーブル
CREATE TABLE IF NOT EXISTS incident_reports (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,

  -- 報告種別
  report_type TEXT NOT NULL CHECK (report_type IN (
    'complaint',     -- 苦情
    'accident',      -- 事故
    'near_miss',     -- ヒヤリハット
    'injury'         -- 怪我
  )),

  -- 基本情報
  title TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL, -- 発生日時
  discovered_at TIMESTAMPTZ, -- 発見日時
  reported_at TIMESTAMPTZ DEFAULT NOW(), -- 報告日時
  location TEXT, -- 発生場所

  -- 関係者情報
  child_id TEXT REFERENCES children(id) ON DELETE SET NULL,
  child_name TEXT, -- 児童名（削除後も記録保持）
  reporter_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  reporter_name TEXT, -- 報告者名

  -- 詳細情報
  description TEXT NOT NULL, -- 概要・状況
  cause TEXT, -- 原因
  immediate_action TEXT, -- 応急処置・初期対応
  injury_details TEXT, -- 怪我の状況（事故・怪我の場合）
  hospital_visit BOOLEAN DEFAULT FALSE, -- 受診の有無
  hospital_name TEXT, -- 受診先
  diagnosis TEXT, -- 診断内容

  -- 苦情対応（苦情の場合）
  complainant_type TEXT, -- 苦情申出者（保護者、第三者等）
  complainant_name TEXT, -- 申出者名
  complaint_content TEXT, -- 苦情内容
  response_content TEXT, -- 対応内容
  response_date DATE, -- 対応日

  -- 対策・再発防止
  prevention_measures TEXT, -- 再発防止策
  improvement_plan TEXT, -- 改善計画
  follow_up_notes TEXT, -- 経過観察メモ

  -- 報告・共有
  family_notified BOOLEAN DEFAULT FALSE, -- 家族への連絡
  family_notified_at TIMESTAMPTZ,
  family_notified_by TEXT,
  staff_shared BOOLEAN DEFAULT FALSE, -- スタッフ共有
  staff_shared_at TIMESTAMPTZ,

  -- 行政報告（重大事故の場合）
  admin_report_required BOOLEAN DEFAULT FALSE, -- 行政報告要否
  admin_reported BOOLEAN DEFAULT FALSE, -- 行政報告済み
  admin_reported_at TIMESTAMPTZ,
  admin_report_number TEXT, -- 報告番号

  -- 添付ファイル
  attachments JSONB, -- [{ name: "...", url: "...", type: "..." }]

  -- ステータス
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft',        -- 下書き
    'submitted',    -- 提出済み
    'reviewing',    -- 確認中
    'resolved',     -- 対応完了
    'closed'        -- クローズ
  )),

  -- 重要度
  severity TEXT DEFAULT 'low' CHECK (severity IN (
    'low',          -- 軽微
    'medium',       -- 中程度
    'high',         -- 重大
    'critical'      -- 緊急
  )),

  -- メタデータ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_incident_reports_facility ON incident_reports(facility_id);
CREATE INDEX IF NOT EXISTS idx_incident_reports_type ON incident_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_incident_reports_status ON incident_reports(status);
CREATE INDEX IF NOT EXISTS idx_incident_reports_occurred_at ON incident_reports(occurred_at);
CREATE INDEX IF NOT EXISTS idx_incident_reports_child ON incident_reports(child_id);

-- RLS有効化
ALTER TABLE incident_reports ENABLE ROW LEVEL SECURITY;

-- RLSポリシー
CREATE POLICY "incident_reports_select" ON incident_reports FOR SELECT USING (true);
CREATE POLICY "incident_reports_insert" ON incident_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "incident_reports_update" ON incident_reports FOR UPDATE USING (true);
CREATE POLICY "incident_reports_delete" ON incident_reports FOR DELETE USING (true);

-- コメント
COMMENT ON TABLE incident_reports IS '苦情・事故・ヒヤリハット報告';
COMMENT ON COLUMN incident_reports.report_type IS '報告種別: complaint=苦情, accident=事故, near_miss=ヒヤリハット, injury=怪我';
COMMENT ON COLUMN incident_reports.severity IS '重要度: low=軽微, medium=中程度, high=重大, critical=緊急';
COMMENT ON COLUMN incident_reports.status IS 'ステータス: draft=下書き, submitted=提出済み, reviewing=確認中, resolved=対応完了, closed=クローズ';
