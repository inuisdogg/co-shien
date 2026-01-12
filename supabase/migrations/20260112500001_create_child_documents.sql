-- 児童の必要書類管理テーブル
-- 契約書、アセスメントシートなどの書類を管理

-- 書類タイプのENUM
CREATE TYPE document_type AS ENUM (
  'contract',           -- 契約書
  'assessment',         -- アセスメントシート
  'support_plan',       -- 個別支援計画書
  'beneficiary_cert',   -- 受給者証
  'medical_cert',       -- 診断書・医療証明
  'insurance_card',     -- 保険証
  'emergency_contact',  -- 緊急連絡先
  'photo_consent',      -- 写真掲載同意書
  'other'               -- その他
);

-- 書類ステータスのENUM
CREATE TYPE document_status AS ENUM (
  'required',     -- 必要（未提出）
  'submitted',    -- 提出済み（確認中）
  'approved',     -- 承認済み
  'expired',      -- 期限切れ
  'rejected'      -- 差し戻し
);

-- 児童書類テーブル
CREATE TABLE child_documents (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,

  -- 書類情報
  document_type document_type NOT NULL,
  document_name TEXT NOT NULL,          -- 書類名（カスタム名）
  description TEXT,                     -- 説明・備考

  -- ステータス
  status document_status NOT NULL DEFAULT 'required',

  -- ファイル情報（Supabase Storage連携用）
  file_path TEXT,                       -- ストレージ内のパス
  file_name TEXT,                       -- 元のファイル名
  file_size INTEGER,                    -- ファイルサイズ（バイト）
  mime_type TEXT,                       -- MIMEタイプ

  -- 期限管理
  due_date DATE,                        -- 提出期限
  expiry_date DATE,                     -- 有効期限（受給者証など）

  -- 確認情報
  submitted_at TIMESTAMPTZ,             -- 提出日時
  submitted_by TEXT,                    -- 提出者ID
  reviewed_at TIMESTAMPTZ,              -- 確認日時
  reviewed_by TEXT,                     -- 確認者ID
  rejection_reason TEXT,                -- 差し戻し理由

  -- メタデータ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 同一児童の同一タイプの書類は複数存在可能（更新版など）
  -- ただし、有効なのは最新のもの
  version INTEGER DEFAULT 1
);

-- インデックス
CREATE INDEX idx_child_documents_facility ON child_documents(facility_id);
CREATE INDEX idx_child_documents_child ON child_documents(child_id);
CREATE INDEX idx_child_documents_type ON child_documents(document_type);
CREATE INDEX idx_child_documents_status ON child_documents(status);
CREATE INDEX idx_child_documents_due ON child_documents(due_date) WHERE status = 'required';
CREATE INDEX idx_child_documents_expiry ON child_documents(expiry_date) WHERE status = 'approved';

-- RLSポリシー
ALTER TABLE child_documents ENABLE ROW LEVEL SECURITY;

-- 認証ユーザーは全ての操作可能（実際の運用ではより細かく設定）
CREATE POLICY "child_documents_select" ON child_documents FOR SELECT USING (true);
CREATE POLICY "child_documents_insert" ON child_documents FOR INSERT WITH CHECK (true);
CREATE POLICY "child_documents_update" ON child_documents FOR UPDATE USING (true);
CREATE POLICY "child_documents_delete" ON child_documents FOR DELETE USING (true);

-- 施設ごとのデフォルト必要書類テンプレート
CREATE TABLE document_templates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,

  document_type document_type NOT NULL,
  document_name TEXT NOT NULL,
  description TEXT,
  is_required BOOLEAN DEFAULT true,      -- 必須かどうか
  default_due_days INTEGER,              -- 契約から何日以内に提出が必要か

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(facility_id, document_type, document_name)
);

-- RLSポリシー
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "document_templates_select" ON document_templates FOR SELECT USING (true);
CREATE POLICY "document_templates_insert" ON document_templates FOR INSERT WITH CHECK (true);
CREATE POLICY "document_templates_update" ON document_templates FOR UPDATE USING (true);
CREATE POLICY "document_templates_delete" ON document_templates FOR DELETE USING (true);

-- デフォルトの書類テンプレートを施設demo-001に追加
INSERT INTO document_templates (id, facility_id, document_type, document_name, description, is_required, default_due_days) VALUES
  ('tpl-001', 'facility-demo-001', 'contract', '利用契約書', '施設利用に関する契約書', true, 7),
  ('tpl-002', 'facility-demo-001', 'assessment', 'アセスメントシート', '初回アセスメント', true, 14),
  ('tpl-003', 'facility-demo-001', 'support_plan', '個別支援計画書', '6ヶ月ごとの支援計画', true, 30),
  ('tpl-004', 'facility-demo-001', 'beneficiary_cert', '受給者証（コピー）', '受給者証の写し', true, 7),
  ('tpl-005', 'facility-demo-001', 'photo_consent', '写真掲載同意書', 'HP・SNSでの写真掲載に関する同意', false, 14),
  ('tpl-006', 'facility-demo-001', 'emergency_contact', '緊急連絡先カード', '緊急時の連絡先情報', true, 7);

COMMENT ON TABLE child_documents IS '児童ごとの必要書類を管理するテーブル';
COMMENT ON TABLE document_templates IS '施設ごとのデフォルト必要書類テンプレート';
