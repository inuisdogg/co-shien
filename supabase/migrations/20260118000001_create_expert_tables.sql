-- Expert領域用テーブル作成マイグレーション
-- 福祉専門職がオンラインで相談サービスを提供するプラットフォーム

-- ========================================
-- 1. エキスパートプロフィール
-- ========================================
CREATE TABLE IF NOT EXISTS expert_profiles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  -- 基本情報
  display_name TEXT NOT NULL,
  profession TEXT NOT NULL CHECK (profession IN (
    'PT', 'OT', 'ST', 'psychologist', 'nursery_teacher',
    'nurse', 'dietitian', 'social_worker'
  )),
  specialty TEXT[] DEFAULT '{}',
  introduction TEXT,
  experience_years INTEGER,

  -- 資格情報（運営手動確認用）
  qualification_status TEXT DEFAULT 'pending' CHECK (
    qualification_status IN ('pending', 'verified', 'rejected')
  ),
  qualification_documents TEXT[] DEFAULT '{}',
  qualification_verified_at TIMESTAMPTZ,
  qualification_verified_by TEXT,

  -- カスタマイズ設定
  page_theme JSONB DEFAULT '{
    "primaryColor": "#10B981",
    "backgroundStyle": "simple",
    "headerImage": null,
    "profileImage": null,
    "customCss": null
  }'::JSONB,

  -- 料金設定
  price_per_message INTEGER NOT NULL DEFAULT 300,
  free_first_message BOOLEAN DEFAULT true,

  -- 公開設定
  is_public BOOLEAN DEFAULT false,
  is_accepting_consultations BOOLEAN DEFAULT true,

  -- 統計
  total_consultations INTEGER DEFAULT 0,
  total_columns INTEGER DEFAULT 0,
  rating_average NUMERIC(2,1) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expert_profiles_user_id ON expert_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_expert_profiles_profession ON expert_profiles(profession);
CREATE INDEX IF NOT EXISTS idx_expert_profiles_public ON expert_profiles(is_public, is_accepting_consultations);
CREATE INDEX IF NOT EXISTS idx_expert_profiles_specialty ON expert_profiles USING GIN(specialty);

-- ========================================
-- 2. エキスパート料金設定
-- ========================================
CREATE TABLE IF NOT EXISTS expert_pricing (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  expert_id TEXT NOT NULL REFERENCES expert_profiles(id) ON DELETE CASCADE,

  pricing_type TEXT NOT NULL CHECK (pricing_type IN (
    'message',
    'video_30min',
    'video_60min'
  )),

  price INTEGER NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(expert_id, pricing_type)
);

CREATE INDEX IF NOT EXISTS idx_expert_pricing_expert ON expert_pricing(expert_id);

-- ========================================
-- 3. コラム
-- ========================================
CREATE TABLE IF NOT EXISTS expert_columns (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  expert_id TEXT NOT NULL REFERENCES expert_profiles(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  content TEXT NOT NULL,
  thumbnail_url TEXT,
  tags TEXT[] DEFAULT '{}',

  is_published BOOLEAN DEFAULT false,
  is_premium BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,

  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expert_columns_expert ON expert_columns(expert_id);
CREATE INDEX IF NOT EXISTS idx_expert_columns_published ON expert_columns(is_published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_expert_columns_tags ON expert_columns USING GIN(tags);

-- ========================================
-- 4. ポイント残高
-- ========================================
CREATE TABLE IF NOT EXISTS user_points (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  balance INTEGER DEFAULT 0,
  total_purchased INTEGER DEFAULT 0,
  total_used INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_points_user ON user_points(user_id);

-- ========================================
-- 5. ポイント取引履歴
-- ========================================
CREATE TABLE IF NOT EXISTS point_transactions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'purchase',
    'consume',
    'refund',
    'bonus',
    'expire'
  )),

  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,

  related_consultation_id TEXT,
  related_order_id TEXT,

  description TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_point_transactions_user ON point_transactions(user_id, created_at DESC);

-- ========================================
-- 6. サブスクリプション
-- ========================================
CREATE TABLE IF NOT EXISTS expert_subscriptions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expert_id TEXT NOT NULL REFERENCES expert_profiles(id) ON DELETE CASCADE,

  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'cancelled', 'expired'
  )),

  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  cancelled_at TIMESTAMPTZ,

  monthly_price INTEGER DEFAULT 980,

  priority_consultation BOOLEAN DEFAULT true,
  premium_content_access BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, expert_id)
);

CREATE INDEX IF NOT EXISTS idx_expert_subscriptions_user ON expert_subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_expert_subscriptions_expert ON expert_subscriptions(expert_id, status);

-- ========================================
-- 7. 相談スレッド
-- ========================================
CREATE TABLE IF NOT EXISTS consultation_threads (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  expert_id TEXT NOT NULL REFERENCES expert_profiles(id) ON DELETE CASCADE,
  client_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'open',
    'resolved',
    'closed'
  )),

  subject TEXT NOT NULL,
  child_age TEXT,
  consultation_type TEXT[] DEFAULT '{}',

  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,

  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  rating_comment TEXT,
  rated_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consultation_threads_expert ON consultation_threads(expert_id, status);
CREATE INDEX IF NOT EXISTS idx_consultation_threads_client ON consultation_threads(client_user_id, status);
CREATE INDEX IF NOT EXISTS idx_consultation_threads_last_message ON consultation_threads(last_message_at DESC);

-- ========================================
-- 8. 相談メッセージ
-- ========================================
CREATE TABLE IF NOT EXISTS consultation_messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  thread_id TEXT NOT NULL REFERENCES consultation_threads(id) ON DELETE CASCADE,

  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('expert', 'client')),

  message TEXT NOT NULL,
  attachments TEXT[] DEFAULT '{}',

  points_consumed INTEGER DEFAULT 0,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consultation_messages_thread ON consultation_messages(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_consultation_messages_unread ON consultation_messages(thread_id, is_read) WHERE is_read = false;

-- ========================================
-- 9. コラムいいね
-- ========================================
CREATE TABLE IF NOT EXISTS column_likes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  column_id TEXT NOT NULL REFERENCES expert_columns(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(column_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_column_likes_column ON column_likes(column_id);
CREATE INDEX IF NOT EXISTS idx_column_likes_user ON column_likes(user_id);

-- ========================================
-- RLS Policies
-- ========================================

-- expert_profiles: 公開プロフィールは誰でも閲覧可能
ALTER TABLE expert_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expert_profiles_select_public" ON expert_profiles
  FOR SELECT USING (is_public = true OR user_id = auth.uid()::TEXT);

CREATE POLICY "expert_profiles_insert" ON expert_profiles
  FOR INSERT WITH CHECK (user_id = auth.uid()::TEXT);

CREATE POLICY "expert_profiles_update" ON expert_profiles
  FOR UPDATE USING (user_id = auth.uid()::TEXT);

CREATE POLICY "expert_profiles_delete" ON expert_profiles
  FOR DELETE USING (user_id = auth.uid()::TEXT);

-- expert_pricing: エキスパート本人のみ編集可能
ALTER TABLE expert_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expert_pricing_select" ON expert_pricing
  FOR SELECT USING (true);

CREATE POLICY "expert_pricing_modify" ON expert_pricing
  FOR ALL USING (
    expert_id IN (SELECT id FROM expert_profiles WHERE user_id = auth.uid()::TEXT)
  );

-- expert_columns: 公開コラムは誰でも閲覧可能
ALTER TABLE expert_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expert_columns_select" ON expert_columns
  FOR SELECT USING (
    is_published = true
    OR expert_id IN (SELECT id FROM expert_profiles WHERE user_id = auth.uid()::TEXT)
  );

CREATE POLICY "expert_columns_modify" ON expert_columns
  FOR ALL USING (
    expert_id IN (SELECT id FROM expert_profiles WHERE user_id = auth.uid()::TEXT)
  );

-- user_points: 本人のみアクセス可能
ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_points_own" ON user_points
  FOR ALL USING (user_id = auth.uid()::TEXT);

-- point_transactions: 本人のみアクセス可能
ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "point_transactions_own" ON point_transactions
  FOR ALL USING (user_id = auth.uid()::TEXT);

-- expert_subscriptions: 購読者とエキスパート本人のみアクセス可能
ALTER TABLE expert_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expert_subscriptions_access" ON expert_subscriptions
  FOR SELECT USING (
    user_id = auth.uid()::TEXT
    OR expert_id IN (SELECT id FROM expert_profiles WHERE user_id = auth.uid()::TEXT)
  );

CREATE POLICY "expert_subscriptions_modify" ON expert_subscriptions
  FOR ALL USING (user_id = auth.uid()::TEXT);

-- consultation_threads: 当事者のみアクセス可能
ALTER TABLE consultation_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consultation_threads_access" ON consultation_threads
  FOR ALL USING (
    client_user_id = auth.uid()::TEXT
    OR expert_id IN (SELECT id FROM expert_profiles WHERE user_id = auth.uid()::TEXT)
  );

-- consultation_messages: 当事者のみアクセス可能
ALTER TABLE consultation_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consultation_messages_access" ON consultation_messages
  FOR ALL USING (
    thread_id IN (
      SELECT id FROM consultation_threads
      WHERE client_user_id = auth.uid()::TEXT
      OR expert_id IN (SELECT id FROM expert_profiles WHERE user_id = auth.uid()::TEXT)
    )
  );

-- column_likes: 本人のみ追加・削除可能
ALTER TABLE column_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "column_likes_select" ON column_likes
  FOR SELECT USING (true);

CREATE POLICY "column_likes_modify" ON column_likes
  FOR ALL USING (user_id = auth.uid()::TEXT);

-- ========================================
-- Realtime有効化
-- ========================================
ALTER PUBLICATION supabase_realtime ADD TABLE consultation_messages;

-- ========================================
-- Triggers for updated_at
-- ========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_expert_profiles_updated_at
  BEFORE UPDATE ON expert_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expert_pricing_updated_at
  BEFORE UPDATE ON expert_pricing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expert_columns_updated_at
  BEFORE UPDATE ON expert_columns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_points_updated_at
  BEFORE UPDATE ON user_points
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expert_subscriptions_updated_at
  BEFORE UPDATE ON expert_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_consultation_threads_updated_at
  BEFORE UPDATE ON consultation_threads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_consultation_messages_updated_at
  BEFORE UPDATE ON consultation_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- Helper Functions
-- ========================================

-- ポイント追加関数
CREATE OR REPLACE FUNCTION add_points(
  p_user_id TEXT,
  p_amount INTEGER,
  p_description TEXT DEFAULT NULL,
  p_order_id TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  -- user_pointsがなければ作成
  INSERT INTO user_points (user_id, balance, total_purchased)
  VALUES (p_user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- ポイント追加
  UPDATE user_points
  SET
    balance = balance + p_amount,
    total_purchased = total_purchased + p_amount,
    updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_new_balance;

  -- 取引履歴に記録
  INSERT INTO point_transactions (user_id, transaction_type, amount, balance_after, related_order_id, description)
  VALUES (p_user_id, 'purchase', p_amount, v_new_balance, p_order_id, p_description);

  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ポイント消費関数
CREATE OR REPLACE FUNCTION consume_points(
  p_user_id TEXT,
  p_amount INTEGER,
  p_consultation_id TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- 現在の残高を取得
  SELECT balance INTO v_current_balance
  FROM user_points
  WHERE user_id = p_user_id;

  IF v_current_balance IS NULL OR v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient points balance';
  END IF;

  -- ポイント消費
  UPDATE user_points
  SET
    balance = balance - p_amount,
    total_used = total_used + p_amount,
    updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_new_balance;

  -- 取引履歴に記録
  INSERT INTO point_transactions (user_id, transaction_type, amount, balance_after, related_consultation_id, description)
  VALUES (p_user_id, 'consume', -p_amount, v_new_balance, p_consultation_id, p_description);

  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 相談メッセージ数更新トリガー
CREATE OR REPLACE FUNCTION update_thread_message_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE consultation_threads
  SET
    message_count = message_count + 1,
    last_message_at = NEW.created_at,
    updated_at = NOW()
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_consultation_message_insert
  AFTER INSERT ON consultation_messages
  FOR EACH ROW EXECUTE FUNCTION update_thread_message_count();

-- コラムいいね数更新トリガー
CREATE OR REPLACE FUNCTION update_column_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE expert_columns SET like_count = like_count + 1 WHERE id = NEW.column_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE expert_columns SET like_count = like_count - 1 WHERE id = OLD.column_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_column_like_change
  AFTER INSERT OR DELETE ON column_likes
  FOR EACH ROW EXECUTE FUNCTION update_column_like_count();

-- ========================================
-- 開発用：全アクセス許可ポリシー（本番では削除）
-- ========================================
-- 開発環境用のため、より緩いポリシーを追加
CREATE POLICY "expert_profiles_dev_allow_all" ON expert_profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "expert_pricing_dev_allow_all" ON expert_pricing FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "expert_columns_dev_allow_all" ON expert_columns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "user_points_dev_allow_all" ON user_points FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "point_transactions_dev_allow_all" ON point_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "expert_subscriptions_dev_allow_all" ON expert_subscriptions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "consultation_threads_dev_allow_all" ON consultation_threads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "consultation_messages_dev_allow_all" ON consultation_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "column_likes_dev_allow_all" ON column_likes FOR ALL USING (true) WITH CHECK (true);
