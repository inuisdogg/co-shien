-- =============================================
-- 全国展開に向けたスケーリング拡張マイグレーション
-- 対象: 施設ジオコーディング、認証、レビュー、
--       スカウト、面接日程、通知システム、全文検索、
--       ユーザープロフィール強化
-- 作成日: 2026-02-28
-- =============================================

-- =============================================
-- 1. 施設テーブルへのジオコーディングフィールド追加
--    位置情報による施設検索を可能にする
-- =============================================

-- 緯度
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
-- 経度
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
-- JIS X 0401 都道府県コード（例: '13' = 東京都）
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS prefecture_code TEXT;
-- 市区町村コード
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS city_code TEXT;
-- 施設タイプ
-- 'child_development_support' = 児童発達支援
-- 'after_school_day' = 放課後等デイサービス
-- 'severe_disability' = 重度障害者等包括支援
-- 'employment_transition' = 就労移行支援
-- 'employment_continuation_a' = 就労継続支援A型
-- 'employment_continuation_b' = 就労継続支援B型
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS facility_type TEXT;

-- 地理検索用インデックス
CREATE INDEX IF NOT EXISTS idx_facilities_lat_lng ON facilities(lat, lng);
CREATE INDEX IF NOT EXISTS idx_facilities_prefecture_code ON facilities(prefecture_code);
CREATE INDEX IF NOT EXISTS idx_facilities_city_code ON facilities(city_code);
CREATE INDEX IF NOT EXISTS idx_facilities_facility_type ON facilities(facility_type);

-- =============================================
-- 2. 施設認証・評価フィールド追加
--    指定事業所番号による認証と口コミ集計
-- =============================================

-- 指定事業所番号（行政から発行される番号）
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS certification_number TEXT;
-- 認証ステータス: 'unverified' | 'pending' | 'verified' | 'rejected'
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS certification_status TEXT DEFAULT 'unverified';
-- 認証完了日時
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS certification_verified_at TIMESTAMPTZ;
-- 平均評価（キャッシュ用、レビュー追加時に更新）
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS average_rating DOUBLE PRECISION DEFAULT 0;
-- レビュー件数（キャッシュ用）
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS review_count INT DEFAULT 0;
-- 施設写真URL配列
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb;

-- 認証番号にインデックス（ユニーク検索用）
CREATE INDEX IF NOT EXISTS idx_facilities_certification_number ON facilities(certification_number);
CREATE INDEX IF NOT EXISTS idx_facilities_certification_status ON facilities(certification_status);

-- =============================================
-- 3. 施設レビューテーブル（facility_reviews）
--    利用者・元従業員からの口コミ情報
-- =============================================

CREATE TABLE IF NOT EXISTS facility_reviews (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  -- レビュー対象の施設
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  -- レビュー投稿者
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- 関連する応募（任意）
  job_application_id TEXT REFERENCES job_applications(id),
  -- 総合評価（1〜5、必須）
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  -- ワークライフバランス評価
  work_life_balance INT CHECK (work_life_balance >= 1 AND work_life_balance <= 5),
  -- 人間関係評価
  staff_relations INT CHECK (staff_relations >= 1 AND staff_relations <= 5),
  -- 成長機会評価
  growth_opportunity INT CHECK (growth_opportunity >= 1 AND growth_opportunity <= 5),
  -- マネジメント評価
  management INT CHECK (management >= 1 AND management <= 5),
  -- レビュータイトル
  title TEXT,
  -- 良い点
  pros TEXT,
  -- 改善点
  cons TEXT,
  -- 匿名投稿フラグ
  is_anonymous BOOLEAN DEFAULT true,
  -- モデレーションステータス: 'pending' | 'approved' | 'rejected'
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- レビュー検索用インデックス
CREATE INDEX IF NOT EXISTS idx_facility_reviews_facility ON facility_reviews(facility_id);
CREATE INDEX IF NOT EXISTS idx_facility_reviews_user ON facility_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_facility_reviews_status ON facility_reviews(status);
CREATE INDEX IF NOT EXISTS idx_facility_reviews_rating ON facility_reviews(rating);

-- =============================================
-- 4. スカウトメッセージテーブル（scout_messages）
--    施設から求職者へのダイレクトスカウト
-- =============================================

CREATE TABLE IF NOT EXISTS scout_messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  -- スカウト元施設
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  -- 送信者（施設スタッフ）
  sender_user_id TEXT NOT NULL REFERENCES users(id),
  -- スカウト対象者（求職者）
  target_user_id TEXT NOT NULL REFERENCES users(id),
  -- 関連求人（任意、求人紐づけスカウト）
  job_posting_id TEXT REFERENCES job_postings(id) ON DELETE SET NULL,
  -- 件名
  subject TEXT NOT NULL,
  -- メッセージ本文
  message TEXT NOT NULL,
  -- ステータス: 'sent' | 'read' | 'replied' | 'declined'
  status TEXT DEFAULT 'sent',
  -- 既読日時
  read_at TIMESTAMPTZ,
  -- 返信日時
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- スカウト検索用インデックス
CREATE INDEX IF NOT EXISTS idx_scout_messages_target ON scout_messages(target_user_id);
CREATE INDEX IF NOT EXISTS idx_scout_messages_facility ON scout_messages(facility_id);
CREATE INDEX IF NOT EXISTS idx_scout_messages_sender ON scout_messages(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_scout_messages_status ON scout_messages(status);

-- =============================================
-- 5. 面接日程テーブル（interview_slots）
--    応募に対する面接スケジュール管理
-- =============================================

CREATE TABLE IF NOT EXISTS interview_slots (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  -- 対象応募
  job_application_id TEXT NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
  -- 提案者: 'facility' | 'applicant'
  proposed_by TEXT NOT NULL,
  -- 提案日時
  proposed_datetime TIMESTAMPTZ NOT NULL,
  -- 面接時間（分）
  duration_minutes INT DEFAULT 30,
  -- 面接形式: 'in_person' | 'online' | 'phone'
  format TEXT DEFAULT 'in_person',
  -- 対面の場合の場所
  location TEXT,
  -- オンラインの場合のURL
  meeting_url TEXT,
  -- ステータス: 'proposed' | 'accepted' | 'declined' | 'cancelled'
  status TEXT DEFAULT 'proposed',
  -- メモ・備考
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 面接スロット検索用インデックス
CREATE INDEX IF NOT EXISTS idx_interview_slots_application ON interview_slots(job_application_id);
CREATE INDEX IF NOT EXISTS idx_interview_slots_datetime ON interview_slots(proposed_datetime);
CREATE INDEX IF NOT EXISTS idx_interview_slots_status ON interview_slots(status);

-- =============================================
-- 6. 採用メッセージの既読機能
--    recruitment_messages に read_at を追加
--    ※ 既存テーブルに read_at がある場合はスキップされる
-- =============================================

ALTER TABLE recruitment_messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- =============================================
-- 7. 通知システム拡張
--    既存の notifications テーブルに不足カラムを追加し、
--    通知設定テーブルを新規作成
-- =============================================

-- 既存 notifications テーブルに body カラムを追加（message の別名として使用可能）
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS body TEXT;
-- 柔軟なペイロード（applicationId, jobId 等）
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;
-- read フラグ追加（既存の is_read との互換性を維持）
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT false;

-- 未読通知の部分インデックス（パフォーマンス最適化）
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id) WHERE read = false;

-- 通知設定テーブル
-- ユーザーごとのメール・プッシュ通知の有効/無効を管理
CREATE TABLE IF NOT EXISTS notification_preferences (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- メール通知設定
  email_new_application BOOLEAN DEFAULT true,   -- 新規応募通知
  email_new_message BOOLEAN DEFAULT true,       -- 新メッセージ通知
  email_status_change BOOLEAN DEFAULT true,     -- ステータス変更通知
  email_scout BOOLEAN DEFAULT true,             -- スカウト通知
  email_job_match BOOLEAN DEFAULT true,         -- 求人マッチング通知
  -- プッシュ通知設定
  push_enabled BOOLEAN DEFAULT true,            -- プッシュ通知全体の有効/無効
  push_new_application BOOLEAN DEFAULT true,    -- 新規応募プッシュ通知
  push_new_message BOOLEAN DEFAULT true,        -- 新メッセージプッシュ通知
  push_status_change BOOLEAN DEFAULT true,      -- ステータス変更プッシュ通知
  push_scout BOOLEAN DEFAULT true,              -- スカウトプッシュ通知
  push_job_match BOOLEAN DEFAULT true,          -- 求人マッチングプッシュ通知
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- ユーザーごとに1レコード
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user ON notification_preferences(user_id);

-- =============================================
-- 8. 求人の全文検索機能（日本語対応）
--    'simple' 辞書設定で日本語テキストに対応
--    （Supabase 標準環境では 'japanese' 辞書が利用不可のため）
-- =============================================

-- 検索用の結合テキストカラム（GENERATED ALWAYS AS ... STORED）
ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS search_text TEXT GENERATED ALWAYS AS (
  COALESCE(title, '') || ' ' || COALESCE(description, '') || ' ' || COALESCE(work_location, '') || ' ' || COALESCE(benefits, '')
) STORED;

-- GINインデックスで全文検索を高速化
CREATE INDEX IF NOT EXISTS idx_job_postings_search ON job_postings USING gin(to_tsvector('simple', COALESCE(search_text, '')));

-- =============================================
-- 9. 求人のジオコーディングフィールド追加
--    地図ベースの求人検索を可能にする
-- =============================================

-- 緯度
ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
-- 経度
ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
-- 都道府県コード（JIS X 0401）
ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS prefecture_code TEXT;

-- 求人の位置情報検索用インデックス
CREATE INDEX IF NOT EXISTS idx_job_postings_lat_lng ON job_postings(lat, lng);
CREATE INDEX IF NOT EXISTS idx_job_postings_prefecture_code ON job_postings(prefecture_code);

-- =============================================
-- 10. ユーザープロフィール拡張（クイック応募対応）
--     求職者がワンクリックで応募できるよう事前情報を保持
-- =============================================

-- 一行自己紹介
ALTER TABLE users ADD COLUMN IF NOT EXISTS headline TEXT;
-- 希望雇用形態（配列: ['full_time', 'part_time', 'spot'] 等）
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_job_types TEXT[];
-- 希望勤務地の都道府県コード配列（例: ['13', '14'] = 東京・神奈川）
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_prefecture_codes TEXT[];
-- 履歴書URL
ALTER TABLE users ADD COLUMN IF NOT EXISTS resume_url TEXT;
-- PWA プッシュ通知用サブスクリプション情報
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_subscription JSONB;

-- =============================================
-- 11. RLS（Row Level Security）ポリシー設定
--     既存のプロジェクトパターンに合わせ、
--     全テーブルで permissive ポリシーを設定
-- =============================================

-- ----- facility_reviews -----
-- 承認済みレビューは全ユーザーが閲覧可能
-- ユーザーは自身のレビューを投稿可能
-- 施設管理者はステータスを更新可能
ALTER TABLE facility_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "facility_reviews_select_policy" ON facility_reviews
  FOR SELECT USING (true);
CREATE POLICY "facility_reviews_insert_policy" ON facility_reviews
  FOR INSERT WITH CHECK (true);
CREATE POLICY "facility_reviews_update_policy" ON facility_reviews
  FOR UPDATE USING (true);
CREATE POLICY "facility_reviews_delete_policy" ON facility_reviews
  FOR DELETE USING (true);

-- ----- scout_messages -----
-- 対象ユーザーが閲覧可能
-- 施設メンバーが自施設のスカウトを送信可能
ALTER TABLE scout_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scout_messages_select_policy" ON scout_messages
  FOR SELECT USING (true);
CREATE POLICY "scout_messages_insert_policy" ON scout_messages
  FOR INSERT WITH CHECK (true);
CREATE POLICY "scout_messages_update_policy" ON scout_messages
  FOR UPDATE USING (true);
CREATE POLICY "scout_messages_delete_policy" ON scout_messages
  FOR DELETE USING (true);

-- ----- interview_slots -----
-- 応募関係者が閲覧・操作可能
ALTER TABLE interview_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "interview_slots_select_policy" ON interview_slots
  FOR SELECT USING (true);
CREATE POLICY "interview_slots_insert_policy" ON interview_slots
  FOR INSERT WITH CHECK (true);
CREATE POLICY "interview_slots_update_policy" ON interview_slots
  FOR UPDATE USING (true);
CREATE POLICY "interview_slots_delete_policy" ON interview_slots
  FOR DELETE USING (true);

-- ----- notification_preferences -----
-- ユーザーは自身の通知設定を管理可能
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_preferences_select_policy" ON notification_preferences
  FOR SELECT USING (true);
CREATE POLICY "notification_preferences_insert_policy" ON notification_preferences
  FOR INSERT WITH CHECK (true);
CREATE POLICY "notification_preferences_update_policy" ON notification_preferences
  FOR UPDATE USING (true);
CREATE POLICY "notification_preferences_delete_policy" ON notification_preferences
  FOR DELETE USING (true);

-- =============================================
-- 12. updated_at 自動更新トリガー
--     更新時にタイムスタンプを自動で現在日時に設定
-- =============================================

-- トリガー関数（既存がなければ作成）
CREATE OR REPLACE FUNCTION update_national_scale_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- facility_reviews の updated_at 自動更新
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_facility_reviews_updated_at'
  ) THEN
    CREATE TRIGGER set_facility_reviews_updated_at
      BEFORE UPDATE ON facility_reviews
      FOR EACH ROW
      EXECUTE FUNCTION update_national_scale_updated_at();
  END IF;
END
$$;

-- notification_preferences の updated_at 自動更新
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_notification_preferences_updated_at'
  ) THEN
    CREATE TRIGGER set_notification_preferences_updated_at
      BEFORE UPDATE ON notification_preferences
      FOR EACH ROW
      EXECUTE FUNCTION update_national_scale_updated_at();
  END IF;
END
$$;

-- =============================================
-- マイグレーション完了
-- 追加されたテーブル:
--   - facility_reviews（施設レビュー）
--   - scout_messages（スカウトメッセージ）
--   - interview_slots（面接スケジュール）
--   - notification_preferences（通知設定）
-- 拡張されたテーブル:
--   - facilities（ジオコーディング・認証・評価）
--   - job_postings（全文検索・ジオコーディング）
--   - users（クイック応募用プロフィール）
--   - recruitment_messages（既読機能）
--   - notifications（body・data・readフラグ追加）
-- =============================================
