-- employment_records テーブルに DELETE ポリシーを追加
-- スタッフ削除時に employment_records の CASCADE/直接DELETE がRLSでブロックされていた
DROP POLICY IF EXISTS "employment_records_delete_v4" ON employment_records;
CREATE POLICY "employment_records_delete_v4" ON employment_records
  FOR DELETE USING (true);

-- staff テーブルにも DELETE ポリシーを確認・追加
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'staff' AND cmd = 'DELETE'
  ) THEN
    CREATE POLICY "staff_delete_anon" ON staff FOR DELETE USING (true);
  END IF;
END $$;
