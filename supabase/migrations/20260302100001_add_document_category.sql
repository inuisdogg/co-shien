-- 受領書類 vs 配布書類の区分を追加
-- received: スタッフから受け取った書類（履歴書、資格証など）
-- distributed: スタッフへ配布した書類（給与明細、労働条件通知書など）

ALTER TABLE staff_documents
  ADD COLUMN IF NOT EXISTS document_category TEXT DEFAULT 'distributed'
  CHECK (document_category IN ('received', 'distributed'));

-- 既存データのマイグレーション：document_typeから自動分類
UPDATE staff_documents
SET document_category = 'received'
WHERE document_type IN (
  'resume',              -- 履歴書
  'qualification_cert',  -- 資格証明書
  'work_experience',     -- 実務経験証明書
  'career_history',      -- 職務経歴書
  'health_checkup',      -- 健康診断書
  'confidentiality_agreement', -- 守秘義務誓約書
  'id_document',         -- 身分証明書
  'commute_certificate', -- 通勤届
  'tax_withholding_form' -- 扶養控除申告書
);

UPDATE staff_documents
SET document_category = 'distributed'
WHERE document_type IN (
  'payslip',             -- 給与明細
  'wage_notice',         -- 賃金通知書
  'employment_contract', -- 雇用契約書・労働条件通知書
  'social_insurance',    -- 社会保険関連
  'withholding_tax',     -- 源泉徴収票
  'year_end_adjustment', -- 年末調整
  'employment_regulation' -- 就業規則
);

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_staff_documents_category ON staff_documents(document_category);

COMMENT ON COLUMN staff_documents.document_category IS '受領(received)=スタッフから受け取った書類 / 配布(distributed)=スタッフへ配布した書類';
