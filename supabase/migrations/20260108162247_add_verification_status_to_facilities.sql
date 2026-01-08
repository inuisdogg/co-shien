-- facilitiesテーブルにverification_statusカラムを追加（存在しない場合）
ALTER TABLE facilities
ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'unverified';

-- コメントを追加
COMMENT ON COLUMN facilities.verification_status IS '認証ステータス: unverified（未認証）, verified（認証済み）';

