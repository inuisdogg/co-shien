-- 書類アップロード・管理テーブル
-- 運営指導に必要な各種書類を一元管理

CREATE TABLE IF NOT EXISTS document_uploads (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,

  -- 書類の種類（運営指導で必要な38種に対応）
  document_type TEXT NOT NULL CHECK (document_type IN (
    -- 事前提出書類
    'self_inspection',          -- 自己点検表
    'staff_schedule',           -- 勤務体制一覧表
    'addition_checklist',       -- 加算算定点検表
    'user_list',                -- 利用者一覧表

    -- 従業員関係
    'employment_contract',      -- 雇用契約書・辞令
    'resume',                   -- 履歴書
    'worker_roster',            -- 労働者名簿
    'wage_document',            -- 賃金関係書類
    'confidentiality_agreement',-- 守秘義務・機密保持誓約書
    'health_checkup',           -- 健康診断書
    'work_schedule',            -- 勤務形態一覧表
    'attendance_record',        -- 出勤簿・タイムカード
    'qualification_cert',       -- 資格証明書

    -- 運営関係
    'designation_application',  -- 指定申請関係書類
    'floor_plan',               -- 平面図
    'equipment_ledger',         -- 設備・備品台帳
    'addition_notification',    -- 加算届出
    'operation_regulation',     -- 運営規定
    'important_explanation',    -- 重要事項説明書
    'service_contract',         -- サービス利用契約書
    'addition_requirement',     -- 加算算定要件書類
    'employment_regulation',    -- 就業規則・給与規則
    'committee_minutes',        -- 委員会議事録
    'liability_insurance',      -- 賠償責任保険証券
    'business_management',      -- 業務管理体制届

    -- 記録関係
    'billing_document',         -- 国保連請求関係書類
    'receipt',                  -- 領収書
    'community_activity',       -- 地域交流記録
    'incident_report',          -- 苦情・事故・ヒヤリハット記録
    'training_record',          -- 職員研修記録
    'restraint_record',         -- 身体拘束・虐待記録
    'evacuation_drill',         -- 消防計画・避難訓練記録
    'accounting_document',      -- 会計関係書類

    -- 利用者支援関連
    'privacy_consent',          -- 個人情報取扱同意書
    'support_plan',             -- 個別支援計画書
    'admission_record',         -- 入退所記録
    'user_count',               -- 利用者・入所者数書類
    'daily_record',             -- 実施記録・業務日誌

    -- その他
    'medication_ledger',        -- 医薬品台帳
    'hygiene_record',           -- 衛生管理記録
    'meal_record',              -- 食事提供記録
    'other'                     -- その他
  )),

  -- 関連エンティティ（どれか一つ、または施設全体）
  staff_id TEXT REFERENCES staff(id) ON DELETE CASCADE,
  child_id TEXT REFERENCES children(id) ON DELETE CASCADE,
  -- staff_id も child_id も NULL の場合は施設全体の書類

  -- 書類情報
  title TEXT NOT NULL,           -- 書類タイトル
  description TEXT,              -- 説明・備考
  file_url TEXT NOT NULL,        -- ファイルURL（Supabase Storage）
  file_name TEXT NOT NULL,       -- 元のファイル名
  file_size INTEGER,             -- ファイルサイズ（bytes）
  file_type TEXT,                -- MIMEタイプ

  -- 有効期間
  valid_from DATE,               -- 有効開始日
  valid_until DATE,              -- 有効期限

  -- 更新情報
  version INTEGER DEFAULT 1,     -- バージョン番号
  previous_version_id TEXT,      -- 前バージョンのID

  -- メタデータ
  tags JSONB,                    -- タグ（検索用）
  uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_document_uploads_facility ON document_uploads(facility_id);
CREATE INDEX IF NOT EXISTS idx_document_uploads_type ON document_uploads(document_type);
CREATE INDEX IF NOT EXISTS idx_document_uploads_staff ON document_uploads(staff_id);
CREATE INDEX IF NOT EXISTS idx_document_uploads_child ON document_uploads(child_id);
CREATE INDEX IF NOT EXISTS idx_document_uploads_valid ON document_uploads(valid_until);

-- RLS有効化
ALTER TABLE document_uploads ENABLE ROW LEVEL SECURITY;

-- RLSポリシー
CREATE POLICY "document_uploads_select" ON document_uploads FOR SELECT USING (true);
CREATE POLICY "document_uploads_insert" ON document_uploads FOR INSERT WITH CHECK (true);
CREATE POLICY "document_uploads_update" ON document_uploads FOR UPDATE USING (true);
CREATE POLICY "document_uploads_delete" ON document_uploads FOR DELETE USING (true);

-- コメント
COMMENT ON TABLE document_uploads IS '書類アップロード管理';
COMMENT ON COLUMN document_uploads.document_type IS '書類種別（運営指導38種対応）';
COMMENT ON COLUMN document_uploads.staff_id IS '関連スタッフ（個人書類の場合）';
COMMENT ON COLUMN document_uploads.child_id IS '関連児童（利用者書類の場合）';

-- Supabase Storageバケット作成用（別途Supabase管理画面で設定必要）
-- バケット名: documents
-- 公開設定: private（認証必要）
