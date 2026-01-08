-- OTPコード管理テーブル
-- ログインID確認などの認証コードを一時的に保存

CREATE TABLE IF NOT EXISTS otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'login_id_recovery',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- インデックス
  CONSTRAINT otp_codes_user_purpose_unique UNIQUE (user_id, purpose)
);

-- インデックスを追加
CREATE INDEX IF NOT EXISTS idx_otp_codes_user_id ON otp_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires_at ON otp_codes(expires_at);

-- RLSを有効化
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

-- サーバーサイドからのアクセスを許可（anon keyでも動作するように）
CREATE POLICY "Allow insert otp_codes"
  ON otp_codes
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow select otp_codes"
  ON otp_codes
  FOR SELECT
  USING (true);

CREATE POLICY "Allow delete otp_codes"
  ON otp_codes
  FOR DELETE
  USING (true);

-- 期限切れのOTPを定期的に削除するための関数（オプション）
CREATE OR REPLACE FUNCTION cleanup_expired_otp_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM otp_codes WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
