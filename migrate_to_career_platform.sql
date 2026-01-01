-- ============================================
-- キャリアプラットフォームへの移行マイグレーション
-- ============================================
-- 「事業所がスタッフを管理するツール」から
-- 「スタッフ個人がキャリアを持ち運べるプラットフォーム」への移行
-- ============================================

-- ============================================
-- 1. 個人アカウントテーブル（usersテーブルの再構築）
-- ============================================
-- 既存のusersテーブルを個人アカウントとして独立させる
-- facility_idを削除し、個人が複数の事業所に所属できるようにする

-- 新しいusersテーブル構造（既存データを保持しつつ構造変更）
-- まず、既存のusersテーブルのデータをバックアップ用テーブルに保存
CREATE TABLE IF NOT EXISTS users_backup AS 
SELECT * FROM users WHERE 1=0;

INSERT INTO users_backup SELECT * FROM users;

-- usersテーブルを再構築
-- 注意: 本番環境では慎重に実行してください

-- 一時的にfacility_idカラムを保持（後で削除）
-- 新しいカラムを追加
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'pending' CHECK (account_status IN ('pending', 'active', 'suspended'));
-- pending: 招待送信済み、パスワード未設定（仮登録）
-- active: パスワード設定済み、アクティブ
-- suspended: アカウント停止

ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by_facility_id TEXT REFERENCES facilities(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;

-- 既存のfacility_idをinvited_by_facility_idにコピー（移行用）
UPDATE users SET invited_by_facility_id = facility_id WHERE invited_by_facility_id IS NULL;

-- ============================================
-- 2. 所属関係テーブル（EmploymentRecord）
-- ============================================
-- ユーザーと事業所の所属関係を管理
-- 複数の事業所に所属可能、期間管理、役割管理

CREATE TABLE IF NOT EXISTS employment_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  -- 所属期間
  start_date DATE NOT NULL,
  end_date DATE, -- NULLの場合は現在も在籍中
  -- 役割・職位
  role TEXT NOT NULL CHECK (role IN ('一般スタッフ', 'マネージャー', '管理者')),
  employment_type TEXT NOT NULL CHECK (employment_type IN ('常勤', '非常勤')),
  -- 権限設定（この事業所での権限）
  permissions JSONB DEFAULT '{}'::JSONB,
  -- 実務経験証明のステータス
  experience_verification_status TEXT DEFAULT 'not_requested' CHECK (experience_verification_status IN (
    'not_requested',  -- 未申請
    'requested',      -- 申請中
    'approved',       -- 承認済み
    'rejected',       -- 却下
    'expired'         -- 期限切れ
  )),
  experience_verification_requested_at TIMESTAMPTZ,
  experience_verification_approved_at TIMESTAMPTZ,
  experience_verification_approved_by TEXT, -- 承認者のuser_id
  -- メタデータ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 制約: 同じユーザーが同じ事業所に同時に複数のアクティブな所属レコードを持たない
-- 注意: 期間の重複チェックはアプリケーションレベルで実装
CREATE UNIQUE INDEX IF NOT EXISTS idx_employment_records_active_unique 
  ON employment_records(user_id, facility_id) 
  WHERE end_date IS NULL;

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_employment_records_user_id ON employment_records(user_id);
CREATE INDEX IF NOT EXISTS idx_employment_records_facility_id ON employment_records(facility_id);
CREATE INDEX IF NOT EXISTS idx_employment_records_status ON employment_records(experience_verification_status);

-- ============================================
-- 3. 実務経験証明依頼テーブル（ExperienceVerificationRequest）
-- ============================================
-- スタッフが元職場に実務経験証明を依頼するワークフロー

CREATE TABLE IF NOT EXISTS experience_verification_requests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  -- 申請者（スタッフ）
  requester_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- 対象の所属記録
  employment_record_id TEXT NOT NULL REFERENCES employment_records(id) ON DELETE CASCADE,
  -- 承認者（元職場の管理者）
  approver_facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  approver_user_id TEXT, -- 承認者のuser_id（承認時に設定）
  -- 申請内容
  requested_period_start DATE NOT NULL,
  requested_period_end DATE,
  requested_role TEXT, -- 申請時の役割
  -- ステータス
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',    -- 申請中
    'approved',   -- 承認済み
    'rejected',   -- 却下
    'expired'     -- 期限切れ（一定期間応答がない場合）
  )),
  -- メッセージ
  request_message TEXT, -- 申請者からのメッセージ
  response_message TEXT, -- 承認者からのメッセージ
  rejection_reason TEXT, -- 却下理由
  -- デジタル署名
  digital_signature TEXT, -- 承認者のデジタル署名（ハッシュ）
  signed_at TIMESTAMPTZ,
  -- メタデータ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days') -- 30日で期限切れ
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_verification_requests_requester ON experience_verification_requests(requester_user_id);
CREATE INDEX IF NOT EXISTS idx_verification_requests_approver_facility ON experience_verification_requests(approver_facility_id);
CREATE INDEX IF NOT EXISTS idx_verification_requests_status ON experience_verification_requests(status);
CREATE INDEX IF NOT EXISTS idx_verification_requests_employment_record ON experience_verification_requests(employment_record_id);

-- ============================================
-- 4. 個人キャリアデータテーブル（UserCareer）
-- ============================================
-- スタッフ個人が所有するキャリアデータ（資格、認証済み職歴など）

CREATE TABLE IF NOT EXISTS user_careers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- 資格情報
  qualification_name TEXT NOT NULL,
  qualification_type TEXT, -- 例: "国家資格", "民間資格"
  issued_by TEXT, -- 発行機関
  issued_date DATE,
  expiry_date DATE, -- 有効期限（あれば）
  certificate_url TEXT, -- 資格証のURL（ストレージ）
  -- 認証済み職歴（employment_recordsから承認済みのものを参照）
  verified_employment_record_id TEXT REFERENCES employment_records(id) ON DELETE SET NULL,
  -- メタデータ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_user_careers_user_id ON user_careers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_careers_verified_record ON user_careers(verified_employment_record_id);

-- ============================================
-- 5. 既存データの移行
-- ============================================
-- 既存のusersテーブルのデータをemployment_recordsに移行

-- 既存のusersレコードをemployment_recordsに移行
INSERT INTO employment_records (
  id,
  user_id,
  facility_id,
  start_date,
  end_date,
  role,
  employment_type,
  permissions,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid()::TEXT,
  u.id,
  u.facility_id,
  u.created_at::DATE,
  NULL, -- 現在も在籍中と仮定
  CASE 
    WHEN u.role = 'admin' THEN '管理者'
    WHEN u.role = 'manager' THEN 'マネージャー'
    ELSE '一般スタッフ'
  END,
  '常勤', -- デフォルト値（後で修正可能）
  u.permissions,
  u.created_at,
  u.updated_at
FROM users u
WHERE u.facility_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================
-- 6. 更新日時の自動更新トリガー
-- ============================================
CREATE TRIGGER update_employment_records_updated_at BEFORE UPDATE ON employment_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_experience_verification_requests_updated_at BEFORE UPDATE ON experience_verification_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_careers_updated_at BEFORE UPDATE ON user_careers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 7. ビューの作成（便利なクエリ用）
-- ============================================
-- 現在アクティブな所属関係を取得するビュー
CREATE OR REPLACE VIEW active_employments AS
SELECT 
  er.*,
  u.name AS user_name,
  u.email AS user_email,
  f.name AS facility_name,
  f.code AS facility_code
FROM employment_records er
JOIN users u ON er.user_id = u.id
JOIN facilities f ON er.facility_id = f.id
WHERE er.end_date IS NULL OR er.end_date >= CURRENT_DATE;

-- 承認済みの実務経験を持つユーザーのビュー
CREATE OR REPLACE VIEW verified_careers AS
SELECT 
  er.*,
  u.name AS user_name,
  f.name AS facility_name,
  er.experience_verification_approved_at AS verified_at
FROM employment_records er
JOIN users u ON er.user_id = u.id
JOIN facilities f ON er.facility_id = f.id
WHERE er.experience_verification_status = 'approved';

-- ============================================
-- 8. 関数の作成
-- ============================================
-- ユーザーが特定の事業所に所属しているかチェック
CREATE OR REPLACE FUNCTION is_user_employed_at_facility(
  p_user_id TEXT,
  p_facility_id TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM employment_records
    WHERE user_id = p_user_id
      AND facility_id = p_facility_id
      AND (end_date IS NULL OR end_date >= CURRENT_DATE)
  );
END;
$$ LANGUAGE plpgsql;

-- 実務経験証明の承認処理
CREATE OR REPLACE FUNCTION approve_experience_verification(
  p_request_id TEXT,
  p_approver_user_id TEXT,
  p_signature TEXT,
  p_message TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_employment_record_id TEXT;
BEGIN
  -- リクエストを取得
  SELECT employment_record_id INTO v_employment_record_id
  FROM experience_verification_requests
  WHERE id = p_request_id AND status = 'pending';
  
  IF v_employment_record_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- リクエストを承認済みに更新
  UPDATE experience_verification_requests
  SET 
    status = 'approved',
    approver_user_id = p_approver_user_id,
    digital_signature = p_signature,
    response_message = p_message,
    signed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_request_id;
  
  -- 所属記録のステータスを更新
  UPDATE employment_records
  SET 
    experience_verification_status = 'approved',
    experience_verification_approved_at = NOW(),
    experience_verification_approved_by = p_approver_user_id,
    updated_at = NOW()
  WHERE id = v_employment_record_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 完了メッセージ
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'キャリアプラットフォームへの移行マイグレーションが完了しました！';
  RAISE NOTICE '作成されたテーブル:';
  RAISE NOTICE '  - employment_records (所属関係)';
  RAISE NOTICE '  - experience_verification_requests (実務経験証明依頼)';
  RAISE NOTICE '  - user_careers (個人キャリアデータ)';
  RAISE NOTICE '';
  RAISE NOTICE '注意: usersテーブルのfacility_idカラムは後で削除する必要があります。';
  RAISE NOTICE 'まず、既存データが正しく移行されているか確認してください。';
END $$;

