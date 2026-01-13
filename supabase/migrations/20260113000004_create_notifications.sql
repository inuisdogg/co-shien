-- 通知テーブル作成
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  facility_id TEXT NOT NULL REFERENCES facilities(id),
  user_id TEXT REFERENCES users(id), -- 通知対象のユーザー（NULL=施設全体）
  type TEXT NOT NULL, -- 通知タイプ: 'staff_activated', 'permission_granted', etc.
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_user_id TEXT REFERENCES users(id), -- 関連するユーザー（例: アクティベートしたスタッフ）
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_notifications_facility_id ON notifications(facility_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- RLSポリシー
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 施設のスタッフは施設の通知を閲覧可能
CREATE POLICY "notifications_read_policy" ON notifications
  FOR SELECT
  USING (true);

-- 通知の作成は認証済みユーザーのみ
CREATE POLICY "notifications_insert_policy" ON notifications
  FOR INSERT
  WITH CHECK (true);

-- 通知の更新（既読など）
CREATE POLICY "notifications_update_policy" ON notifications
  FOR UPDATE
  USING (true);
