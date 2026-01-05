-- ============================================
-- パスキー（WebAuthn）テーブル作成
-- ============================================
-- WebAuthn/Passkey認証情報を保存するテーブル

CREATE TABLE IF NOT EXISTS passkeys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- クレデンシャル情報
  credential_id TEXT NOT NULL UNIQUE, -- Base64エンコードされたクレデンシャルID
  public_key BYTEA NOT NULL, -- 公開鍵（バイナリデータ）
  counter BIGINT NOT NULL DEFAULT 0, -- 署名カウンター（リプレイ攻撃防止用）
  -- デバイス情報
  device_name TEXT, -- デバイス名（例: "iPhone", "Chrome on Windows"）
  device_type TEXT, -- デバイスタイプ（例: "platform", "cross-platform"）
  -- 認証情報
  aaguid UUID, -- Authenticator Attestation Globally Unique Identifier
  -- メタデータ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ, -- 最後に使用された日時
  -- パーソナルアカウント向け（facility_idがNULLの場合は個人向け）
  facility_code TEXT, -- 施設コード（個人向けの場合はNULL）
  login_id TEXT NOT NULL, -- ログインID（メールアドレスまたは施設コード+ログインID）
  
  UNIQUE(user_id, credential_id)
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_passkeys_user_id ON passkeys(user_id);
CREATE INDEX IF NOT EXISTS idx_passkeys_credential_id ON passkeys(credential_id);
CREATE INDEX IF NOT EXISTS idx_passkeys_login_id ON passkeys(login_id);
CREATE INDEX IF NOT EXISTS idx_passkeys_facility_code ON passkeys(facility_code) WHERE facility_code IS NOT NULL;

-- コメント追加
COMMENT ON TABLE passkeys IS 'WebAuthn/Passkey認証情報を保存するテーブル';
COMMENT ON COLUMN passkeys.credential_id IS 'Base64エンコードされたクレデンシャルID';
COMMENT ON COLUMN passkeys.public_key IS '公開鍵（バイナリデータ）';
COMMENT ON COLUMN passkeys.counter IS '署名カウンター（リプレイ攻撃防止用）';
COMMENT ON COLUMN passkeys.device_name IS 'デバイス名（例: "iPhone", "Chrome on Windows"）';
COMMENT ON COLUMN passkeys.device_type IS 'デバイスタイプ（"platform" または "cross-platform"）';
COMMENT ON COLUMN passkeys.login_id IS 'ログインID（個人向けの場合はメールアドレス、施設向けの場合は施設コード+ログインID）';

-- 完了メッセージ
DO $$
BEGIN
  RAISE NOTICE 'passkeysテーブルが作成されました！';
END $$;

