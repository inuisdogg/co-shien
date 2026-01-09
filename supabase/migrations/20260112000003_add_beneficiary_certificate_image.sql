-- 受給者証の最新版画像を保存するカラムを追加
ALTER TABLE children 
ADD COLUMN IF NOT EXISTS beneficiary_certificate_image_url TEXT;

COMMENT ON COLUMN children.beneficiary_certificate_image_url IS '受給者証の最新版画像URL（Supabase Storage）';

