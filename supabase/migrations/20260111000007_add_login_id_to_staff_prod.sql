-- ============================================
-- staffテーブルにlogin_idカラムを追加（本番環境用）
-- ============================================

ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS login_id TEXT;

