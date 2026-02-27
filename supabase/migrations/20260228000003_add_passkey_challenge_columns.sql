-- パスキーチャレンジをサーバーサイドで管理するためのカラムを追加
-- チャレンジをクライアントに返すのではなく、DBに保存して検証時に使用する

ALTER TABLE users ADD COLUMN IF NOT EXISTS passkey_challenge TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS passkey_challenge_expires TIMESTAMPTZ;

COMMENT ON COLUMN users.passkey_challenge IS 'WebAuthn チャレンジ（サーバーサイド保存、base64url形式）';
COMMENT ON COLUMN users.passkey_challenge_expires IS 'チャレンジの有効期限（5分間）';
