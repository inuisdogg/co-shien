-- staff_documents テーブルの document_type CHECK制約を削除
-- 旧マイグレーションで付与された制約が新しいdocument_type（work_experience, resume等）をブロックしている
ALTER TABLE staff_documents DROP CONSTRAINT IF EXISTS staff_documents_document_type_check;

-- document_category カラムがなければ追加
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_documents' AND column_name = 'document_category'
  ) THEN
    ALTER TABLE staff_documents ADD COLUMN document_category TEXT DEFAULT 'distributed';
  END IF;
END $$;
