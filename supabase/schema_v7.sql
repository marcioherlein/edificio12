-- ============================================================
-- Edificio 12 — Schema v7 (Historical payments Jan–Feb 2026)
-- Run in Supabase SQL Editor
-- ============================================================
-- Units WITHOUT debt as of April 2026: PB A, PB B, PB C, PB D, 1A, 1C, 2A, 2B, 2D
-- (Debtors: 1B, 1D, 2C — they will be registered manually via the payment form)
-- This script adds their Jan and Feb 2026 payment history.
-- ============================================================

-- Monthly fees for the historical months
INSERT INTO monthly_fees (month, amount)
VALUES
  ('2026-01', 35000),
  ('2026-02', 35000)
ON CONFLICT (month) DO NOTHING;

-- ── January 2026 payments ────────────────────────────────────
INSERT INTO payments (unit_id, amount, method, month, date, notes)
SELECT
  id,
  35000,
  'transferencia',
  '2026-01',
  '2026-01-15',
  'Historial — pago registrado retroactivamente'
FROM units
WHERE name NOT IN ('1B', '1D', '2C');

-- ── February 2026 payments ───────────────────────────────────
INSERT INTO payments (unit_id, amount, method, month, date, notes)
SELECT
  id,
  35000,
  'transferencia',
  '2026-02',
  '2026-02-15',
  'Historial — pago registrado retroactivamente'
FROM units
WHERE name NOT IN ('1B', '1D', '2C');
