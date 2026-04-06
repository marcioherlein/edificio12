-- ============================================================
-- Edificio 12 — Schema v9
-- Adds "Reporte" type support and creates the March 2026 final
-- report document entry (pre-seeded placeholder).
--
-- After running this:
--   1. Go to /reports/2026-03 in the app (logged in as admin)
--   2. Click "♻️ Regenerar" to regenerate the report data
--   3. Click "📥 Publicar reporte final" to finalize it
--      (this overwrites the placeholder entry below)
--
-- From May 10, 2026 onwards the Vercel cron handles all reports
-- automatically on the 10th of each month.
-- ============================================================

-- Pre-seed the documents entry for March 2026 so it appears
-- in the Documents tab right away. The admin's "Publicar"
-- button will regenerate it with full HTML content.
INSERT INTO documents (title, file_url, type, created_at)
VALUES (
  'REPORTE FINAL MES MARZO DE 2026',
  '/api/reports/view/2026-03',
  'Reporte',
  '2026-04-10 09:00:00+00'
)
ON CONFLICT DO NOTHING;
