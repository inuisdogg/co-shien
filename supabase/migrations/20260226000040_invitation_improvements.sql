-- Invitation improvements: add resend tracking columns
ALTER TABLE contract_invitations ADD COLUMN IF NOT EXISTS resend_count INTEGER DEFAULT 0;
ALTER TABLE contract_invitations ADD COLUMN IF NOT EXISTS last_resent_at TIMESTAMPTZ;
