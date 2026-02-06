-- プラットフォーム招待トークン（施設紐付け不要のシンプルな招待リンク用）
CREATE TABLE IF NOT EXISTS platform_invitation_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  used_by_facility_id TEXT REFERENCES facilities(id),
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_platform_invitation_tokens_token ON platform_invitation_tokens(token);
CREATE INDEX IF NOT EXISTS idx_platform_invitation_tokens_expires_at ON platform_invitation_tokens(expires_at);

-- RLSを有効化
ALTER TABLE platform_invitation_tokens ENABLE ROW LEVEL SECURITY;

-- 全員が読み取り可能（トークン検証用）
CREATE POLICY "Anyone can read invitation tokens"
  ON platform_invitation_tokens FOR SELECT
  USING (true);

-- オーナーのみ作成可能
CREATE POLICY "Owners can create invitation tokens"
  ON platform_invitation_tokens FOR INSERT
  WITH CHECK (true);

-- 使用済みマーク更新は誰でも可能
CREATE POLICY "Anyone can update used_at"
  ON platform_invitation_tokens FOR UPDATE
  USING (true);

COMMENT ON TABLE platform_invitation_tokens IS 'プラットフォームへの施設招待トークン（施設情報は登録時に入力）';
