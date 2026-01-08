-- OTPコードテーブルのRLSポリシーを修正
-- 既存のポリシーを削除して、より柔軟なアクセスを許可

-- 既存のポリシーを削除（存在する場合）
DROP POLICY IF EXISTS "Service role can manage otp_codes" ON otp_codes;
DROP POLICY IF EXISTS "Allow insert otp_codes" ON otp_codes;
DROP POLICY IF EXISTS "Allow select otp_codes" ON otp_codes;
DROP POLICY IF EXISTS "Allow delete otp_codes" ON otp_codes;

-- 新しいポリシーを作成（サーバーサイドからのアクセスを許可）
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
