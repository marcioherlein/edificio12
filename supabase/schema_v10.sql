-- ============================================================
-- Edificio 12 — Schema v10
-- Clears all documents so the Docs tab starts fresh.
-- Reports are now generated from Resumen (closed month) and
-- auto-published to Documents via /api/reports/generate.
-- ============================================================

DELETE FROM documents;
