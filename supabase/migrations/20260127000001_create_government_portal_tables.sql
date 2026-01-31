-- 行政連携機能のテーブル作成
-- Connect機能を拡張し、行政アカウントからの書類確認・連絡機能を追加

-- ============================================
-- 1. 行政機関マスタ
-- ============================================
CREATE TABLE IF NOT EXISTS government_organizations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name TEXT NOT NULL,                    -- 例: 府中市
  department TEXT,                       -- 例: 福祉保健部 障害者福祉課
  prefecture TEXT,                       -- 都道府県
  municipality_code TEXT,                -- 市区町村コード（総務省コード）
  address TEXT,
  phone TEXT,
  fax TEXT,
  email TEXT,                            -- 代表メールアドレス
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gov_org_name ON government_organizations(name);
CREATE INDEX IF NOT EXISTS idx_gov_org_prefecture ON government_organizations(prefecture);

COMMENT ON TABLE government_organizations IS '行政機関マスタ（市区町村の福祉課など）';

-- ============================================
-- 2. 行政アカウント（メールアドレスでアクセス）
-- ============================================
CREATE TABLE IF NOT EXISTS government_accounts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  organization_id TEXT NOT NULL REFERENCES government_organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT,                             -- 担当者名
  role TEXT DEFAULT 'staff',             -- staff, admin
  access_token TEXT UNIQUE,              -- アクセス用トークン
  token_expires_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gov_account_email ON government_accounts(email);
CREATE INDEX IF NOT EXISTS idx_gov_account_org ON government_accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_gov_account_token ON government_accounts(access_token);

COMMENT ON TABLE government_accounts IS '行政担当者アカウント';

-- ============================================
-- 3. 事業所と管轄行政の紐付け
-- ============================================
CREATE TABLE IF NOT EXISTS facility_government_links (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES government_organizations(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL DEFAULT 'jurisdiction', -- jurisdiction(管轄), other
  primary_contact_email TEXT,            -- 主要連絡先メールアドレス
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(facility_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_fac_gov_link_facility ON facility_government_links(facility_id);
CREATE INDEX IF NOT EXISTS idx_fac_gov_link_org ON facility_government_links(organization_id);

COMMENT ON TABLE facility_government_links IS '事業所と管轄行政機関の紐付け';

-- ============================================
-- 4. 書類カテゴリマスタ
-- ============================================
CREATE TABLE IF NOT EXISTS government_document_categories (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  code TEXT NOT NULL UNIQUE,             -- contract_report, incident_report, etc.
  name TEXT NOT NULL,                    -- 契約内容報告書
  description TEXT,
  submission_frequency TEXT,             -- monthly, quarterly, annually, as_needed
  required_fields JSONB,                 -- 必須フィールドの定義
  template_url TEXT,                     -- テンプレートファイルURL
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 初期データ: 契約内容報告書
INSERT INTO government_document_categories (code, name, description, submission_frequency) VALUES
  ('contract_report', '契約内容報告書', '新規契約・契約変更・契約終了があった児童の報告', 'monthly'),
  ('incident_report', '事故報告書', '事故発生時の報告', 'as_needed'),
  ('monthly_report', '月次実績報告', '月間の利用実績報告', 'monthly'),
  ('self_evaluation', '自己評価結果', '事業所の自己評価報告', 'annually')
ON CONFLICT (code) DO NOTHING;

COMMENT ON TABLE government_document_categories IS '行政提出書類カテゴリ';

-- ============================================
-- 5. 書類提出管理
-- ============================================
CREATE TABLE IF NOT EXISTS government_document_submissions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES government_organizations(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES government_document_categories(id) ON DELETE RESTRICT,

  -- 提出内容
  title TEXT NOT NULL,                   -- 書類タイトル
  target_period TEXT,                    -- 対象期間（例: 2026年1月分）
  target_year INTEGER,
  target_month INTEGER,
  content JSONB,                         -- 書類の内容（JSON形式）
  file_url TEXT,                         -- 添付ファイルURL
  file_name TEXT,

  -- ステータス
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',      -- 下書き
    'submitted',  -- 提出済み
    'received',   -- 受理済み
    'returned',   -- 差戻し
    'completed'   -- 完了
  )),

  -- 提出情報
  submitted_at TIMESTAMPTZ,
  submitted_by TEXT REFERENCES users(id),

  -- 行政側の処理
  received_at TIMESTAMPTZ,
  received_by TEXT REFERENCES government_accounts(id),
  return_reason TEXT,                    -- 差戻し理由
  completion_note TEXT,                  -- 完了時のメモ

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_sub_facility ON government_document_submissions(facility_id);
CREATE INDEX IF NOT EXISTS idx_doc_sub_org ON government_document_submissions(organization_id);
CREATE INDEX IF NOT EXISTS idx_doc_sub_status ON government_document_submissions(status);
CREATE INDEX IF NOT EXISTS idx_doc_sub_period ON government_document_submissions(target_year, target_month);

COMMENT ON TABLE government_document_submissions IS '行政への書類提出管理';

-- ============================================
-- 6. 契約内容報告書の詳細（contract_report用）
-- ============================================
CREATE TABLE IF NOT EXISTS contract_report_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  submission_id TEXT NOT NULL REFERENCES government_document_submissions(id) ON DELETE CASCADE,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  contract_id TEXT REFERENCES contracts(id) ON DELETE SET NULL,

  -- 報告種別
  report_type TEXT NOT NULL CHECK (report_type IN (
    'new',        -- 新規契約
    'change',     -- 契約変更
    'termination' -- 契約終了
  )),

  -- 児童情報（スナップショット）
  child_name TEXT NOT NULL,
  child_birthday DATE,
  recipient_number TEXT,                 -- 受給者番号

  -- 契約情報
  contract_start_date DATE,
  contract_end_date DATE,
  service_type TEXT,                     -- 児童発達支援, 放課後等デイサービス等
  days_per_month INTEGER,                -- 月間利用日数

  -- 変更・終了の詳細
  change_content TEXT,                   -- 変更内容
  termination_reason TEXT,               -- 終了理由

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contract_report_submission ON contract_report_items(submission_id);
CREATE INDEX IF NOT EXISTS idx_contract_report_child ON contract_report_items(child_id);

COMMENT ON TABLE contract_report_items IS '契約内容報告書の明細';

-- ============================================
-- 7. 行政⇔事業所メッセージ
-- ============================================
CREATE TABLE IF NOT EXISTS government_messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES government_organizations(id) ON DELETE CASCADE,

  -- 関連データ（オプション）
  related_submission_id TEXT REFERENCES government_document_submissions(id) ON DELETE SET NULL,
  related_meeting_id TEXT REFERENCES connect_meetings(id) ON DELETE SET NULL,

  -- メッセージ内容
  direction TEXT NOT NULL CHECK (direction IN ('to_facility', 'to_government')),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  attachments JSONB,                     -- [{name, url, type}]

  -- 送信者
  sent_by_user_id TEXT REFERENCES users(id),
  sent_by_gov_account_id TEXT REFERENCES government_accounts(id),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 既読
  read_at TIMESTAMPTZ,
  read_by TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gov_msg_facility ON government_messages(facility_id);
CREATE INDEX IF NOT EXISTS idx_gov_msg_org ON government_messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_gov_msg_direction ON government_messages(direction);
CREATE INDEX IF NOT EXISTS idx_gov_msg_sent_at ON government_messages(sent_at DESC);

COMMENT ON TABLE government_messages IS '行政と事業所間のメッセージ';

-- ============================================
-- 8. 連絡会参加者に行政アカウントを紐付け（既存テーブル拡張）
-- ============================================
ALTER TABLE connect_meeting_participants
ADD COLUMN IF NOT EXISTS government_account_id TEXT REFERENCES government_accounts(id);

-- ============================================
-- RLSポリシー
-- ============================================
ALTER TABLE government_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE government_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE facility_government_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE government_document_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_report_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE government_messages ENABLE ROW LEVEL SECURITY;

-- 基本的な参照ポリシー（認証ユーザーは参照可能）
CREATE POLICY "gov_org_select" ON government_organizations FOR SELECT TO authenticated USING (true);
CREATE POLICY "gov_account_select" ON government_accounts FOR SELECT TO authenticated USING (true);

-- 事業所関連は施設メンバーのみ（auth.uid()をTEXTにキャスト）
CREATE POLICY "fac_gov_link_select" ON facility_government_links FOR SELECT TO authenticated
  USING (facility_id IN (SELECT facility_id FROM staff WHERE user_id = auth.uid()::TEXT));
CREATE POLICY "fac_gov_link_insert" ON facility_government_links FOR INSERT TO authenticated
  WITH CHECK (facility_id IN (SELECT facility_id FROM staff WHERE user_id = auth.uid()::TEXT));
CREATE POLICY "fac_gov_link_update" ON facility_government_links FOR UPDATE TO authenticated
  USING (facility_id IN (SELECT facility_id FROM staff WHERE user_id = auth.uid()::TEXT));

-- 書類提出は施設メンバーまたは行政アカウント
CREATE POLICY "doc_sub_facility_access" ON government_document_submissions FOR ALL TO authenticated
  USING (facility_id IN (SELECT facility_id FROM staff WHERE user_id = auth.uid()::TEXT));

-- メッセージは施設メンバーまたは行政アカウント
CREATE POLICY "gov_msg_facility_access" ON government_messages FOR ALL TO authenticated
  USING (facility_id IN (SELECT facility_id FROM staff WHERE user_id = auth.uid()::TEXT));

-- 契約報告明細は親の書類にアクセス可能な場合
CREATE POLICY "contract_report_items_access" ON contract_report_items FOR ALL TO authenticated
  USING (submission_id IN (
    SELECT id FROM government_document_submissions
    WHERE facility_id IN (SELECT facility_id FROM staff WHERE user_id = auth.uid()::TEXT)
  ));
