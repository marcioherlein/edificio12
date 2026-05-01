-- ============================================================
-- Edificio 12 — Limpieza de datos de Mayo 2026
-- Abril no fue cerrado, por lo que no se puede operar en Mayo.
-- Ejecutar en Supabase SQL Editor (una sola vez)
-- ============================================================

DELETE FROM payments      WHERE month = '2026-05';
DELETE FROM expenses      WHERE date >= '2026-05-01' AND date < '2026-06-01';
DELETE FROM unit_balances WHERE month = '2026-05';
DELETE FROM monthly_fees  WHERE month = '2026-05';
DELETE FROM monthly_reports WHERE month = '2026-05';
DELETE FROM account_balances WHERE month = '2026-05';
