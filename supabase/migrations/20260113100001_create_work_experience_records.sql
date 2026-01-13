-- 実務経験記録テーブル（実務経験証明書発行用）
CREATE TABLE IF NOT EXISTS work_experience_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- 施設・法人情報
  facility_name TEXT NOT NULL,           -- 施設又は事業所名
  corporate_name TEXT,                   -- 法人名
  corporate_address TEXT,                -- 法人所在地
  corporate_phone TEXT,                  -- 電話番号
  representative_name TEXT,              -- 代表者氏名
  contact_email TEXT,                    -- 発行依頼送信先メール
  contact_person_name TEXT,              -- 担当者名（宛名用）

  -- 事業種別（1〜10）
  business_type INTEGER,
  business_type_other TEXT,              -- その他の場合の記載

  -- 業務期間
  start_date DATE NOT NULL,
  end_date DATE,
  total_work_days INTEGER,               -- 実勤務日数
  weekly_average_days NUMERIC(3,1),      -- 週平均勤務日数

  -- 業務内容
  job_title TEXT,                        -- 職名（保育士、児童指導員など）
  employment_type TEXT DEFAULT 'fulltime', -- fulltime/parttime
  job_description TEXT,                  -- 業務内容詳細

  -- 証明書ステータス
  status TEXT DEFAULT 'draft',           -- draft/pending/signed/rejected
  signature_token TEXT UNIQUE,           -- 電子署名用トークン
  signature_requested_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  signed_pdf_url TEXT,
  rejection_reason TEXT,

  -- メール関連
  email_subject TEXT,                    -- カスタマイズされたメール件名
  email_body TEXT,                       -- カスタマイズされたメール本文

  -- 署名データ
  signature_image_url TEXT,              -- 署名画像URL
  seal_image_url TEXT,                   -- 印影画像URL
  signer_name TEXT,                      -- 署名者名
  signer_title TEXT,                     -- 署名者役職

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_work_experience_user_id ON work_experience_records(user_id);
CREATE INDEX IF NOT EXISTS idx_work_experience_status ON work_experience_records(status);
CREATE INDEX IF NOT EXISTS idx_work_experience_token ON work_experience_records(signature_token);

-- RLSポリシー
ALTER TABLE work_experience_records ENABLE ROW LEVEL SECURITY;

-- 自分の記録は閲覧可能
CREATE POLICY "work_experience_read_own" ON work_experience_records
  FOR SELECT USING (true);

-- 自分の記録は作成可能
CREATE POLICY "work_experience_insert_own" ON work_experience_records
  FOR INSERT WITH CHECK (true);

-- 自分の記録は更新可能
CREATE POLICY "work_experience_update_own" ON work_experience_records
  FOR UPDATE USING (true);

-- 自分の記録は削除可能
CREATE POLICY "work_experience_delete_own" ON work_experience_records
  FOR DELETE USING (true);

-- 事業種別マスターテーブル
CREATE TABLE IF NOT EXISTS business_type_master (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT
);

-- 事業種別マスターデータ
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
