-- 施設テーブルに必要なカラムを追加
-- 事業所番号、指定通知書パス、認証ステータス、事前登録フラグ

-- 事業所番号（10桁）
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS business_number TEXT;

-- 指定通知書のパス
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS designation_document_path TEXT;

-- 認証ステータス（unverified: 未認証, pending: 審査中, verified: 認証済み）
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'pending', 'verified'));

-- 事前登録フラグ（プラットフォーム側で事前に作成した施設）
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS pre_registered BOOLEAN DEFAULT FALSE;

-- インデックス
CREATE INDEX IF NOT EXISTS idx_facilities_business_number ON facilities(business_number);
CREATE INDEX IF NOT EXISTS idx_facilities_verification_status ON facilities(verification_status);

COMMENT ON COLUMN facilities.business_number IS '事業所番号（10桁）- 指定通知書に記載の番号';
COMMENT ON COLUMN facilities.designation_document_path IS '指定通知書のストレージパス';
COMMENT ON COLUMN facilities.verification_status IS '認証ステータス: unverified(未認証), pending(審査中), verified(認証済み)';
COMMENT ON COLUMN facilities.pre_registered IS 'プラットフォーム側で事前登録された施設かどうか';
