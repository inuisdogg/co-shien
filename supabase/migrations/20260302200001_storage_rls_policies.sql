-- Storage RLS policies for anon role
-- The app uses custom auth (not Supabase Auth sessions), so all client requests
-- go through the anon key. Without these policies, createSignedUrl() fails.

-- Allow anon to read (SELECT) from documents bucket
CREATE POLICY "documents_select_anon"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id = 'documents');

-- Allow anon to insert (upload) to documents bucket
CREATE POLICY "documents_insert_anon"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'documents');

-- Allow anon to delete from documents bucket
CREATE POLICY "documents_delete_anon"
  ON storage.objects FOR DELETE
  TO anon
  USING (bucket_id = 'documents');

-- Allow anon to update (e.g. replace) in documents bucket
CREATE POLICY "documents_update_anon"
  ON storage.objects FOR UPDATE
  TO anon
  USING (bucket_id = 'documents');

-- Same for child-documents bucket (used by ChildDocumentsManager)
CREATE POLICY "child_documents_select_anon"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id = 'child-documents');

CREATE POLICY "child_documents_insert_anon"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'child-documents');

CREATE POLICY "child_documents_delete_anon"
  ON storage.objects FOR DELETE
  TO anon
  USING (bucket_id = 'child-documents');
