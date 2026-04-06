-- ============================================================
-- Edificio 12 — Schema v6 (Storage RLS for receipts bucket)
-- Run in Supabase SQL Editor
-- ============================================================

-- Create the receipts bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow admins to upload files to the receipts bucket
CREATE POLICY "admin_upload_receipts" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Allow anyone to read receipts (for public URLs to work)
CREATE POLICY "public_read_receipts" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'receipts');

-- Allow admins to delete receipts
CREATE POLICY "admin_delete_receipts" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'receipts'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
