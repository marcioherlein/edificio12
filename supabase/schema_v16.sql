-- ============================================================
-- Edificio 12 — Schema v16
-- Security hardening: RLS policies + monthly_reports write guard
-- Run in Supabase SQL Editor
-- ============================================================

-- monthly_reports: only admins (service role) may write.
-- SELECT already covered by authenticated_read in schema_v2.
CREATE POLICY "admin_write_monthly_reports"
  ON monthly_reports FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
