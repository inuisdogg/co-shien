-- 施設オンボーディングフロー改善
-- platform_invitation_tokens にメモ欄を追加

ALTER TABLE platform_invitation_tokens
  ADD COLUMN IF NOT EXISTS memo_company_name TEXT,
  ADD COLUMN IF NOT EXISTS memo_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS memo_contact_email TEXT;
