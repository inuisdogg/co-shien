-- コネクト（連絡会調整）機能用テーブル

-- 連絡会メインテーブル
CREATE TABLE IF NOT EXISTS connect_meetings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,

  -- 会議情報
  title TEXT NOT NULL,
  purpose TEXT,
  location TEXT,
  estimated_duration INTEGER, -- 所要時間（分）
  description TEXT,

  -- ステータス
  status TEXT NOT NULL DEFAULT 'scheduling' CHECK (status IN (
    'scheduling',   -- 日程調整中
    'confirmed',    -- 日程確定
    'completed',    -- 開催完了
    'cancelled'     -- キャンセル
  )),

  -- 確定日程
  confirmed_date_option_id TEXT,
  confirmed_at TIMESTAMPTZ,
  confirmed_by TEXT REFERENCES users(id) ON DELETE SET NULL,

  -- メタデータ
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_connect_meetings_facility ON connect_meetings(facility_id);
CREATE INDEX IF NOT EXISTS idx_connect_meetings_child ON connect_meetings(child_id);
CREATE INDEX IF NOT EXISTS idx_connect_meetings_status ON connect_meetings(status);
CREATE INDEX IF NOT EXISTS idx_connect_meetings_created_at ON connect_meetings(created_at DESC);

-- RLS
ALTER TABLE connect_meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "connect_meetings_all" ON connect_meetings FOR ALL USING (true);

COMMENT ON TABLE connect_meetings IS '連絡会調整（コネクト）メイン管理';

---

-- 日程候補テーブル
CREATE TABLE IF NOT EXISTS connect_meeting_date_options (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  meeting_id TEXT NOT NULL REFERENCES connect_meetings(id) ON DELETE CASCADE,

  -- 日程情報
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME,

  -- 集計（回答によって更新）
  available_count INTEGER DEFAULT 0,
  maybe_count INTEGER DEFAULT 0,
  unavailable_count INTEGER DEFAULT 0,

  -- メタデータ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_connect_date_options_meeting ON connect_meeting_date_options(meeting_id);
CREATE INDEX IF NOT EXISTS idx_connect_date_options_date ON connect_meeting_date_options(date);

-- RLS
ALTER TABLE connect_meeting_date_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "connect_date_options_all" ON connect_meeting_date_options FOR ALL USING (true);

COMMENT ON TABLE connect_meeting_date_options IS '連絡会の日程候補';

---

-- 参加依頼先テーブル
CREATE TABLE IF NOT EXISTS connect_meeting_participants (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  meeting_id TEXT NOT NULL REFERENCES connect_meetings(id) ON DELETE CASCADE,

  -- 組織情報
  organization_name TEXT NOT NULL,
  representative_email TEXT NOT NULL,
  representative_name TEXT,

  -- アクセストークン（外部回答用）
  access_token TEXT NOT NULL UNIQUE,
  token_expires_at TIMESTAMPTZ NOT NULL,

  -- ステータス
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',      -- 招待送信済み・未回答
    'responded',    -- 回答済み
    'declined'      -- 辞退
  )),

  -- 回答情報
  responded_at TIMESTAMPTZ,
  responder_name TEXT,

  -- メール送信履歴
  invitation_sent_at TIMESTAMPTZ,
  reminder_sent_at TIMESTAMPTZ,
  confirmation_sent_at TIMESTAMPTZ,

  -- メタデータ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_connect_participants_meeting ON connect_meeting_participants(meeting_id);
CREATE INDEX IF NOT EXISTS idx_connect_participants_token ON connect_meeting_participants(access_token);
CREATE INDEX IF NOT EXISTS idx_connect_participants_email ON connect_meeting_participants(representative_email);

-- RLS
ALTER TABLE connect_meeting_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "connect_participants_all" ON connect_meeting_participants FOR ALL USING (true);

COMMENT ON TABLE connect_meeting_participants IS '連絡会の参加依頼先';

---

-- 日程回答テーブル
CREATE TABLE IF NOT EXISTS connect_meeting_responses (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  participant_id TEXT NOT NULL REFERENCES connect_meeting_participants(id) ON DELETE CASCADE,
  date_option_id TEXT NOT NULL REFERENCES connect_meeting_date_options(id) ON DELETE CASCADE,

  -- 回答
  response TEXT NOT NULL CHECK (response IN (
    'available',    -- ◯ 参加可能
    'maybe',        -- △ 調整可能
    'unavailable'   -- × 不可
  )),

  -- メタデータ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 同じ参加者・日程の組み合わせは一意
  UNIQUE(participant_id, date_option_id)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_connect_responses_participant ON connect_meeting_responses(participant_id);
CREATE INDEX IF NOT EXISTS idx_connect_responses_date_option ON connect_meeting_responses(date_option_id);

-- RLS
ALTER TABLE connect_meeting_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "connect_responses_all" ON connect_meeting_responses FOR ALL USING (true);

COMMENT ON TABLE connect_meeting_responses IS '連絡会の日程回答';

---

-- 集計更新用の関数
CREATE OR REPLACE FUNCTION update_date_option_counts()
RETURNS TRIGGER AS $$
BEGIN
  -- 対象の日程オプションの集計を更新
  UPDATE connect_meeting_date_options
  SET
    available_count = (
      SELECT COUNT(*) FROM connect_meeting_responses
      WHERE date_option_id = COALESCE(NEW.date_option_id, OLD.date_option_id)
      AND response = 'available'
    ),
    maybe_count = (
      SELECT COUNT(*) FROM connect_meeting_responses
      WHERE date_option_id = COALESCE(NEW.date_option_id, OLD.date_option_id)
      AND response = 'maybe'
    ),
    unavailable_count = (
      SELECT COUNT(*) FROM connect_meeting_responses
      WHERE date_option_id = COALESCE(NEW.date_option_id, OLD.date_option_id)
      AND response = 'unavailable'
    ),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.date_option_id, OLD.date_option_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 回答変更時に自動で集計を更新するトリガー
DROP TRIGGER IF EXISTS trigger_update_date_option_counts ON connect_meeting_responses;
CREATE TRIGGER trigger_update_date_option_counts
  AFTER INSERT OR UPDATE OR DELETE ON connect_meeting_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_date_option_counts();
