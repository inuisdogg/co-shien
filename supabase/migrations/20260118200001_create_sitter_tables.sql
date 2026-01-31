-- Sitter領域用テーブル作成マイグレーション
-- 発達支援特化ベビーシッターサービス

-- ========================================
-- 1. シッタープロフィール
-- ========================================
CREATE TABLE IF NOT EXISTS sitter_profiles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  -- 基本情報
  display_name TEXT NOT NULL,
  profile_image TEXT,
  introduction TEXT,

  -- 資格・専門性
  professions TEXT[] DEFAULT '{}', -- PT, OT, ST, nursery_teacher, nurse, etc.
  specialty TEXT[] DEFAULT '{}',   -- 発語遅滞, 運動発達, ダウン症対応, etc.

  -- 料金設定
  hourly_rate INTEGER NOT NULL DEFAULT 3000, -- 時給（円）
  minimum_hours INTEGER DEFAULT 2,           -- 最低利用時間

  -- 対応エリア
  service_areas TEXT[] DEFAULT '{}',  -- 対応可能な市区町村
  can_travel BOOLEAN DEFAULT true,    -- 出張可能か
  travel_fee INTEGER DEFAULT 0,       -- 交通費

  -- 東京都補助金対応
  is_tokyo_certified BOOLEAN DEFAULT false, -- 東京都研修修了
  subsidy_eligible BOOLEAN DEFAULT false,   -- 補助金対象

  -- 公開設定
  is_public BOOLEAN DEFAULT false,
  is_accepting_bookings BOOLEAN DEFAULT true,

  -- 統計
  total_bookings INTEGER DEFAULT 0,
  total_hours NUMERIC(10,2) DEFAULT 0,
  rating_average NUMERIC(2,1) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sitter_profiles_user ON sitter_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_sitter_profiles_public ON sitter_profiles(is_public, is_accepting_bookings);
CREATE INDEX IF NOT EXISTS idx_sitter_profiles_professions ON sitter_profiles USING GIN(professions);
CREATE INDEX IF NOT EXISTS idx_sitter_profiles_areas ON sitter_profiles USING GIN(service_areas);

-- ========================================
-- 2. シッター資格・認定
-- ========================================
CREATE TABLE IF NOT EXISTS sitter_certifications (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  sitter_id TEXT NOT NULL REFERENCES sitter_profiles(id) ON DELETE CASCADE,

  certification_type TEXT NOT NULL CHECK (certification_type IN (
    'tokyo_babysitter_training',  -- 東京都ベビーシッター利用支援事業研修
    'nursery_teacher',            -- 保育士
    'nurse',                      -- 看護師
    'pt',                         -- 理学療法士
    'ot',                         -- 作業療法士
    'st',                         -- 言語聴覚士
    'psychologist',               -- 臨床心理士
    'first_aid',                  -- 救急救命
    'other'
  )),

  certification_name TEXT NOT NULL,
  certification_number TEXT,
  issued_at DATE,
  expires_at DATE,

  -- 確認状態
  verification_status TEXT DEFAULT 'pending' CHECK (
    verification_status IN ('pending', 'verified', 'rejected')
  ),
  document_url TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sitter_certifications_sitter ON sitter_certifications(sitter_id);

-- ========================================
-- 3. シッター空き時間
-- ========================================
CREATE TABLE IF NOT EXISTS sitter_availability (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  sitter_id TEXT NOT NULL REFERENCES sitter_profiles(id) ON DELETE CASCADE,

  -- 日時
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,

  -- 状態
  status TEXT DEFAULT 'available' CHECK (status IN (
    'available',   -- 空き
    'booked',      -- 予約済み
    'blocked'      -- ブロック
  )),

  booking_id TEXT, -- 予約がある場合

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(sitter_id, date, start_time)
);

CREATE INDEX IF NOT EXISTS idx_sitter_availability_sitter ON sitter_availability(sitter_id, date);
CREATE INDEX IF NOT EXISTS idx_sitter_availability_date ON sitter_availability(date, status);

-- ========================================
-- 4. 予約
-- ========================================
CREATE TABLE IF NOT EXISTS sitter_bookings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  sitter_id TEXT NOT NULL REFERENCES sitter_profiles(id) ON DELETE CASCADE,
  client_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  child_id TEXT REFERENCES children(id) ON DELETE SET NULL,

  -- 日時
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  actual_start_time TIMESTAMPTZ,
  actual_end_time TIMESTAMPTZ,

  -- 場所
  location_address TEXT,
  location_notes TEXT,

  -- 料金
  hourly_rate INTEGER NOT NULL,
  estimated_hours NUMERIC(4,2) NOT NULL,
  estimated_total INTEGER NOT NULL,
  actual_hours NUMERIC(4,2),
  actual_total INTEGER,

  -- 補助金
  subsidy_eligible BOOLEAN DEFAULT false,
  subsidy_amount INTEGER DEFAULT 0,  -- 補助金額
  client_payment INTEGER,            -- 実質負担額

  -- 状態
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',     -- 申請中
    'confirmed',   -- 確定
    'in_progress', -- 実施中
    'completed',   -- 完了
    'cancelled',   -- キャンセル
    'no_show'      -- 不履行
  )),

  -- メモ
  client_memo TEXT,       -- 保護者からの連絡事項
  sitter_notes TEXT,      -- シッターメモ

  -- キャンセル
  cancelled_at TIMESTAMPTZ,
  cancelled_by TEXT,
  cancellation_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sitter_bookings_sitter ON sitter_bookings(sitter_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_sitter_bookings_client ON sitter_bookings(client_user_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_sitter_bookings_status ON sitter_bookings(status, booking_date);
CREATE INDEX IF NOT EXISTS idx_sitter_bookings_child ON sitter_bookings(child_id);

-- ========================================
-- 5. 活動報告書（東京都補助金用）
-- ========================================
CREATE TABLE IF NOT EXISTS sitter_reports (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  booking_id TEXT NOT NULL REFERENCES sitter_bookings(id) ON DELETE CASCADE,
  sitter_id TEXT NOT NULL REFERENCES sitter_profiles(id) ON DELETE CASCADE,

  -- 報告内容
  child_condition TEXT,        -- お子様の様子
  activities TEXT,             -- 実施した活動
  developmental_notes TEXT,    -- 発達に関する気づき
  meals_provided TEXT,         -- 食事の提供内容
  special_notes TEXT,          -- 特記事項

  -- 発達支援記録
  language_activities TEXT,    -- 言語活動
  motor_activities TEXT,       -- 運動活動
  social_activities TEXT,      -- 社会性活動

  -- 写真
  photos TEXT[] DEFAULT '{}',

  -- 状態
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft',       -- 下書き
    'submitted',   -- 提出済み
    'approved',    -- 承認済み
    'rejected'     -- 差し戻し
  )),

  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(booking_id)
);

CREATE INDEX IF NOT EXISTS idx_sitter_reports_booking ON sitter_reports(booking_id);
CREATE INDEX IF NOT EXISTS idx_sitter_reports_sitter ON sitter_reports(sitter_id, status);

-- ========================================
-- 6. レビュー
-- ========================================
CREATE TABLE IF NOT EXISTS sitter_reviews (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  booking_id TEXT NOT NULL REFERENCES sitter_bookings(id) ON DELETE CASCADE,
  sitter_id TEXT NOT NULL REFERENCES sitter_profiles(id) ON DELETE CASCADE,
  client_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,

  -- カテゴリ別評価
  communication_rating INTEGER CHECK (communication_rating BETWEEN 1 AND 5),
  expertise_rating INTEGER CHECK (expertise_rating BETWEEN 1 AND 5),
  punctuality_rating INTEGER CHECK (punctuality_rating BETWEEN 1 AND 5),

  -- 表示設定
  is_public BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(booking_id)
);

CREATE INDEX IF NOT EXISTS idx_sitter_reviews_sitter ON sitter_reviews(sitter_id);
CREATE INDEX IF NOT EXISTS idx_sitter_reviews_public ON sitter_reviews(sitter_id, is_public);

-- ========================================
-- 7. お気に入り
-- ========================================
CREATE TABLE IF NOT EXISTS sitter_favorites (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  client_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sitter_id TEXT NOT NULL REFERENCES sitter_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(client_user_id, sitter_id)
);

CREATE INDEX IF NOT EXISTS idx_sitter_favorites_client ON sitter_favorites(client_user_id);
CREATE INDEX IF NOT EXISTS idx_sitter_favorites_sitter ON sitter_favorites(sitter_id);

-- ========================================
-- 8. メッセージスレッド
-- ========================================
CREATE TABLE IF NOT EXISTS sitter_message_threads (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  sitter_id TEXT NOT NULL REFERENCES sitter_profiles(id) ON DELETE CASCADE,
  client_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booking_id TEXT REFERENCES sitter_bookings(id) ON DELETE SET NULL,

  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(sitter_id, client_user_id)
);

CREATE INDEX IF NOT EXISTS idx_sitter_threads_sitter ON sitter_message_threads(sitter_id);
CREATE INDEX IF NOT EXISTS idx_sitter_threads_client ON sitter_message_threads(client_user_id);

-- ========================================
-- 9. メッセージ
-- ========================================
CREATE TABLE IF NOT EXISTS sitter_messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  thread_id TEXT NOT NULL REFERENCES sitter_message_threads(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('sitter', 'client')),

  message TEXT NOT NULL,
  attachments TEXT[] DEFAULT '{}',

  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sitter_messages_thread ON sitter_messages(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sitter_messages_unread ON sitter_messages(thread_id, is_read) WHERE is_read = false;

-- ========================================
-- RLS Policies
-- ========================================

-- sitter_profiles: 公開プロフィールは誰でも閲覧可能
ALTER TABLE sitter_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sitter_profiles_select_public" ON sitter_profiles
  FOR SELECT USING (is_public = true OR user_id = auth.uid()::TEXT);
CREATE POLICY "sitter_profiles_insert" ON sitter_profiles
  FOR INSERT WITH CHECK (user_id = auth.uid()::TEXT);
CREATE POLICY "sitter_profiles_update" ON sitter_profiles
  FOR UPDATE USING (user_id = auth.uid()::TEXT);

-- 開発用ポリシー
CREATE POLICY "sitter_profiles_dev_allow_all" ON sitter_profiles FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE sitter_certifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sitter_certifications_dev_allow_all" ON sitter_certifications FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE sitter_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sitter_availability_dev_allow_all" ON sitter_availability FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE sitter_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sitter_bookings_dev_allow_all" ON sitter_bookings FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE sitter_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sitter_reports_dev_allow_all" ON sitter_reports FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE sitter_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sitter_reviews_dev_allow_all" ON sitter_reviews FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE sitter_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sitter_favorites_dev_allow_all" ON sitter_favorites FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE sitter_message_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sitter_message_threads_dev_allow_all" ON sitter_message_threads FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE sitter_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sitter_messages_dev_allow_all" ON sitter_messages FOR ALL USING (true) WITH CHECK (true);

-- ========================================
-- Realtime有効化
-- ========================================
ALTER PUBLICATION supabase_realtime ADD TABLE sitter_messages;

-- ========================================
-- Triggers
-- ========================================

CREATE TRIGGER update_sitter_profiles_updated_at
  BEFORE UPDATE ON sitter_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sitter_availability_updated_at
  BEFORE UPDATE ON sitter_availability
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sitter_bookings_updated_at
  BEFORE UPDATE ON sitter_bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sitter_reports_updated_at
  BEFORE UPDATE ON sitter_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sitter_message_threads_updated_at
  BEFORE UPDATE ON sitter_message_threads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- Helper Functions
-- ========================================

-- レビュー投稿時に評価平均を更新
CREATE OR REPLACE FUNCTION update_sitter_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE sitter_profiles
  SET
    rating_average = (
      SELECT COALESCE(AVG(rating), 0)
      FROM sitter_reviews
      WHERE sitter_id = NEW.sitter_id AND is_public = true
    ),
    rating_count = (
      SELECT COUNT(*)
      FROM sitter_reviews
      WHERE sitter_id = NEW.sitter_id AND is_public = true
    )
  WHERE id = NEW.sitter_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_sitter_review_change
  AFTER INSERT OR UPDATE OR DELETE ON sitter_reviews
  FOR EACH ROW EXECUTE FUNCTION update_sitter_rating();

-- 予約完了時に統計更新
CREATE OR REPLACE FUNCTION update_sitter_booking_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE sitter_profiles
    SET
      total_bookings = total_bookings + 1,
      total_hours = total_hours + COALESCE(NEW.actual_hours, NEW.estimated_hours)
    WHERE id = NEW.sitter_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_sitter_booking_complete
  AFTER INSERT OR UPDATE ON sitter_bookings
  FOR EACH ROW EXECUTE FUNCTION update_sitter_booking_stats();
