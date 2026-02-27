-- =============================================
-- ホームページ設定カラム追加マイグレーション
-- facility_settings テーブルに施設ホームページ用のフィールドを追加
-- 作成日: 2026-02-28
-- =============================================

-- ホームページ公開フラグ（デフォルト: 有効）
ALTER TABLE facility_settings ADD COLUMN IF NOT EXISTS homepage_enabled BOOLEAN DEFAULT true;

-- ホームページ用キャッチコピー
ALTER TABLE facility_settings ADD COLUMN IF NOT EXISTS homepage_tagline TEXT;

-- ホームページ用施設紹介文
ALTER TABLE facility_settings ADD COLUMN IF NOT EXISTS homepage_description TEXT;

-- カバー画像URL
ALTER TABLE facility_settings ADD COLUMN IF NOT EXISTS homepage_cover_image_url TEXT;

-- フォトギャラリー（URL配列）
ALTER TABLE facility_settings ADD COLUMN IF NOT EXISTS homepage_photos TEXT[] DEFAULT '{}';

-- テーマカラー（デフォルト: teal）
ALTER TABLE facility_settings ADD COLUMN IF NOT EXISTS homepage_theme TEXT DEFAULT 'teal';
