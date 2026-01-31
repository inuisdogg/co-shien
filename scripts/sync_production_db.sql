-- ============================================
-- 本番DB同期スクリプト
-- 開発DBと本番DBの差分を解消
-- ============================================

-- ============================================
-- 1. facilities テーブル - owner_user_id追加
-- ============================================
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS owner_user_id TEXT REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_facilities_owner_user_id ON facilities(owner_user_id);
COMMENT ON COLUMN facilities.owner_user_id IS '施設のオーナー（マスター管理者）のユーザーID';

-- ============================================
-- 2. attendance_records テーブル - 不足カラム追加
-- ============================================
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS is_manual_correction BOOLEAN DEFAULT FALSE;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS correction_reason TEXT;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS corrected_by TEXT REFERENCES users(id);
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS location_lat DECIMAL(10, 8);
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS location_lng DECIMAL(11, 8);
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS memo TEXT;

-- ============================================
-- 3. notifications テーブル作成
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  facility_id TEXT NOT NULL REFERENCES facilities(id),
  user_id TEXT REFERENCES users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_user_id TEXT REFERENCES users(id),
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_facility_id ON notifications(facility_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_read_policy" ON notifications;
CREATE POLICY "notifications_read_policy" ON notifications FOR SELECT USING (true);

DROP POLICY IF EXISTS "notifications_insert_policy" ON notifications;
CREATE POLICY "notifications_insert_policy" ON notifications FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "notifications_update_policy" ON notifications;
CREATE POLICY "notifications_update_policy" ON notifications FOR UPDATE USING (true);

-- ============================================
-- 4. work_experience_records テーブル作成
-- ============================================
CREATE TABLE IF NOT EXISTS work_experience_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  facility_name TEXT NOT NULL,
  corporate_name TEXT,
  corporate_address TEXT,
  corporate_phone TEXT,
  representative_name TEXT,
  contact_email TEXT,
  contact_person_name TEXT,
  business_type INTEGER,
  business_type_other TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  total_work_days INTEGER,
  weekly_average_days NUMERIC(3,1),
  job_title TEXT,
  employment_type TEXT DEFAULT 'fulltime',
  job_description TEXT,
  status TEXT DEFAULT 'draft',
  signature_token TEXT UNIQUE,
  signature_requested_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  signed_pdf_url TEXT,
  rejection_reason TEXT,
  email_subject TEXT,
  email_body TEXT,
  signature_image_url TEXT,
  seal_image_url TEXT,
  signer_name TEXT,
  signer_title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_experience_user_id ON work_experience_records(user_id);
CREATE INDEX IF NOT EXISTS idx_work_experience_status ON work_experience_records(status);
CREATE INDEX IF NOT EXISTS idx_work_experience_token ON work_experience_records(signature_token);

ALTER TABLE work_experience_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "work_experience_read_own" ON work_experience_records;
CREATE POLICY "work_experience_read_own" ON work_experience_records FOR SELECT USING (true);

DROP POLICY IF EXISTS "work_experience_insert_own" ON work_experience_records;
CREATE POLICY "work_experience_insert_own" ON work_experience_records FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "work_experience_update_own" ON work_experience_records;
CREATE POLICY "work_experience_update_own" ON work_experience_records FOR UPDATE USING (true);

DROP POLICY IF EXISTS "work_experience_delete_own" ON work_experience_records;
CREATE POLICY "work_experience_delete_own" ON work_experience_records FOR DELETE USING (true);

-- ============================================
-- 5. business_type_master テーブル作成
-- ============================================
CREATE TABLE IF NOT EXISTS business_type_master (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT
);

INSERT INTO business_type_master (id, name, description) VALUES
  (1, '障害児入所施設等', '障害児入所施設、乳児院、児童家庭支援センター、児童養護施設、障害者支援施設'),
  (2, '認可保育園等', '認可保育園、幼保連携型認定保育園、地域型認定保育園'),
  (3, '学校・幼稚園等', '学校、幼稚園、幼稚園型認定保育園、事業所内保育事業、居宅訪問型保育事業、家庭的保育事業'),
  (4, '障害通所支援等', '障害通所支援事業、放課後児童健全育成事業'),
  (5, '小規模保育等', '小規模保育事業、病児保育事業、地域子育て支援拠点事業、子育て援助活動支援事業'),
  (6, '障害福祉サービス', '障害福祉サービス事業（生活介護、共同生活援助、居宅介護、就労継続支援など）'),
  (7, '老人福祉施設等', '老人福祉施設、老人居宅介護、老人通所介護、地域包括支援センター、更生施設'),
  (8, '相談支援事業等', '障害児（者）相談支援事業、児童相談所、地域生活支援事業、障害者就業支援センター'),
  (9, 'その他', 'その他'),
  (10, '認可外保育園等', '認可外保育園、企業主導型保育事業')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 6. 施設22580のオーナー設定（畠昂哉さん）
-- ============================================
UPDATE facilities
SET owner_user_id = 'efa867aa-b46d-4df3-8876-d94a7e4cf662'
WHERE code = '22580';

-- ============================================
-- 7. マイグレーション履歴を同期
-- ============================================
INSERT INTO supabase_migrations.schema_migrations (version) VALUES
  ('20260113000001'),
  ('20260113000002'),
  ('20260113000003'),
  ('20260113000004'),
  ('20260113000005'),
  ('20260113100001')
ON CONFLICT DO NOTHING;

-- ============================================
-- 確認
-- ============================================
SELECT 'sync completed' as status;
