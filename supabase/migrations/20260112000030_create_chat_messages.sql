-- チャットメッセージテーブル（保護者と施設のコミュニケーション用）
-- 施設ごとに1つのチャットルーム

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  -- 保護者のユーザーID（施設ごとのチャットなので保護者を特定）
  client_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- 送信者情報
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('staff', 'client')),
  sender_name TEXT NOT NULL,
  -- メッセージ
  message TEXT NOT NULL,
  -- 既読管理
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  -- メタデータ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_chat_facility_client ON chat_messages(facility_id, client_user_id);
CREATE INDEX IF NOT EXISTS idx_chat_created_at ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_sender ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_unread ON chat_messages(facility_id, client_user_id, is_read) WHERE is_read = false;

-- Supabase Realtimeを有効化
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

-- コメント追加
COMMENT ON TABLE chat_messages IS '保護者と施設スタッフ間のチャットメッセージ';
COMMENT ON COLUMN chat_messages.facility_id IS '施設ID';
COMMENT ON COLUMN chat_messages.client_user_id IS '保護者（クライアント）のユーザーID';
COMMENT ON COLUMN chat_messages.sender_id IS '送信者のユーザーID';
COMMENT ON COLUMN chat_messages.sender_type IS '送信者種別（staff: スタッフ, client: 保護者）';
COMMENT ON COLUMN chat_messages.sender_name IS '送信者の表示名';
COMMENT ON COLUMN chat_messages.message IS 'メッセージ本文';
COMMENT ON COLUMN chat_messages.is_read IS '既読フラグ';
COMMENT ON COLUMN chat_messages.read_at IS '既読日時';
