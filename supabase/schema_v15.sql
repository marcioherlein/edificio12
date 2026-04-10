-- ============================================================
-- Edificio 12 — Schema v15
-- Run in Supabase SQL Editor
-- ============================================================

-- Add payer_name to payments (full name of the person paying, may differ from unit owner_name)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payer_name text;
