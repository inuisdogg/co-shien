-- 委員会議事録テーブル
-- 運営指導で必須の「各種委員会（運営推進会議、虐待防止、身体拘束等）」の記録

-- 委員会議事録テーブル
CREATE TABLE IF NOT EXISTS committee_meetings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,

  -- 委員会種別
  committee_type TEXT NOT NULL CHECK (committee_type IN (
    'operation_promotion',  -- 運営推進会議
    'abuse_prevention',     -- 虐待防止委員会
    'restraint_review',     -- 身体拘束適正化委員会
    'safety',               -- 安全委員会
    'infection_control',    -- 感染症対策委員会
    'quality_improvement',  -- サービス向上委員会
    'other'                 -- その他
  )),
  committee_name TEXT, -- 委員会名（その他の場合など）

  -- 開催情報
  meeting_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  location TEXT, -- 開催場所
  meeting_type TEXT CHECK (meeting_type IN (
    'regular',      -- 定例
    'extraordinary' -- 臨時
  )),

  -- 参加者
  attendees JSONB, -- [{ name: "...", role: "...", organization: "...", attended: true }]
  external_attendees TEXT, -- 外部参加者（テキスト）
  facilitator_name TEXT, -- 司会者
  recorder_name TEXT, -- 記録者

  -- 議事内容
  agenda JSONB, -- [{ title: "...", content: "...", decision: "..." }]
  discussion_points TEXT, -- 議論のポイント
  decisions TEXT, -- 決定事項
  action_items JSONB, -- [{ task: "...", assignee: "...", deadline: "..." }]

  -- 報告事項
  reports TEXT, -- 報告事項
  previous_action_review TEXT, -- 前回アクションの振り返り

  -- 次回予定
  next_meeting_date DATE,
  next_agenda_preview TEXT,

  -- 添付ファイル
  attachments JSONB, -- [{ name: "...", url: "...", type: "..." }]

  -- ステータス
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft',      -- 下書き
    'finalized',  -- 確定
    'approved'    -- 承認済み
  )),

  -- 承認
  approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,

  -- メタデータ
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_committee_meetings_facility ON committee_meetings(facility_id);
CREATE INDEX IF NOT EXISTS idx_committee_meetings_date ON committee_meetings(meeting_date);
CREATE INDEX IF NOT EXISTS idx_committee_meetings_type ON committee_meetings(committee_type);
CREATE INDEX IF NOT EXISTS idx_committee_meetings_status ON committee_meetings(status);

-- RLS有効化
ALTER TABLE committee_meetings ENABLE ROW LEVEL SECURITY;

-- RLSポリシー
CREATE POLICY "committee_meetings_select" ON committee_meetings FOR SELECT USING (true);
CREATE POLICY "committee_meetings_insert" ON committee_meetings FOR INSERT WITH CHECK (true);
CREATE POLICY "committee_meetings_update" ON committee_meetings FOR UPDATE USING (true);
CREATE POLICY "committee_meetings_delete" ON committee_meetings FOR DELETE USING (true);

-- コメント
COMMENT ON TABLE committee_meetings IS '委員会議事録';
COMMENT ON COLUMN committee_meetings.committee_type IS '委員会種別';
COMMENT ON COLUMN committee_meetings.agenda IS '議事（JSON配列）';
COMMENT ON COLUMN committee_meetings.action_items IS 'アクションアイテム（JSON配列）';
