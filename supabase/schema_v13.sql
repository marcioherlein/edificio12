-- ============================================================
-- Edificio 12 — Schema v13
-- Run in Supabase SQL Editor
-- ============================================================

-- Add month column to documents
ALTER TABLE documents ADD COLUMN IF NOT EXISTS month text;

-- Storage policies for the documents bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "admin_upload_documents" ON storage.objects;
CREATE POLICY "admin_upload_documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "public_read_documents" ON storage.objects;
CREATE POLICY "public_read_documents" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'documents');

DROP POLICY IF EXISTS "admin_delete_documents" ON storage.objects;
CREATE POLICY "admin_delete_documents" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
