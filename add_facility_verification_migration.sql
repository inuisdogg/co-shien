-- 施設認証機能用マイグレーション
-- facilitiesテーブルに事業所番号、認証ステータス、指定通知書パスを追加
-- join_requestsテーブルを新規作成

-- ============================================
-- 1. facilitiesテーブルにカラム追加
-- ============================================

-- 事業所番号（10桁、一意制約）
ALTER TABLE facilities
ADD COLUMN IF NOT EXISTS business_number VARCHAR(10) UNIQUE;

-- 認証ステータス（unverified, verified）
ALTER TABLE facilities
ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'unverified';

-- 指定通知書のストレージパス
ALTER TABLE facilities
ADD COLUMN IF NOT EXISTS designation_document_path TEXT;

-- 認証日時
ALTER TABLE facilities
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- コメント
COMMENT ON COLUMN facilities.business_number IS '事業所番号（10桁）- 指定通知書に記載';
COMMENT ON COLUMN facilities.verification_status IS '認証ステータス: unverified（未認証）, verified（認証済み）';
COMMENT ON COLUMN facilities.designation_document_path IS '指定通知書のSupabase Storageパス';
COMMENT ON COLUMN facilities.verified_at IS '運営による認証完了日時';

-- ============================================
-- 2. join_requests（参加申請）テーブル作成
-- ============================================

CREATE TABLE IF NOT EXISTS join_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  message TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 同じユーザーが同じ施設に複数申請できないように
  UNIQUE(user_id, facility_id)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_join_requests_user_id ON join_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_facility_id ON join_requests(facility_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_status ON join_requests(status);

-- コメント
COMMENT ON TABLE join_requests IS 'スタッフの施設参加申請';
COMMENT ON COLUMN join_requests.status IS '申請ステータス: pending（保留中）, approved（承認）, rejected（却下）';
COMMENT ON COLUMN join_requests.reviewed_by IS '承認/却下した管理者のユーザーID';

-- ============================================
-- 3. Supabase Storage バケット作成（手動実行）
-- ============================================
-- Supabaseダッシュボードで以下のバケットを作成してください:
-- - バケット名: facility-documents
-- - 公開設定: 非公開（private）

-- RLSポリシー例（Supabaseダッシュボードで設定）:
-- INSERT: authenticated users can upload to their facility folder
-- SELECT: authenticated users can read from their facility folder

COMMENT ON TABLE join_requests IS '
施設認証システムの使用方法:
1. 管理者が施設を登録（/facility/register）
2. 事業所番号と指定通知書をアップロード
3. verification_status = "unverified" で登録
4. 運営が確認後、verification_status = "verified" に更新
5. verified状態で行政提出資料の出力が可能に
';
