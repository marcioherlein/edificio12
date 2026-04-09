-- ============================================================
-- Edificio 12 — Schema v14
-- Run in Supabase SQL Editor
-- ============================================================

-- Make description optional (category + notes replace it)
ALTER TABLE expenses ALTER COLUMN description DROP NOT NULL;
ALTER TABLE expenses ALTER COLUMN description SET DEFAULT NULL;
