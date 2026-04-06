-- ============================================================
-- Edificio 12 — Schema v8 (Correct historical payments per debt level)
-- Run in Supabase SQL Editor
-- ============================================================
-- Debt levels as of April 2026 (opening_balance + April fee):
--   9 clean units  →  $0 opening → owe only April → paid Jan+Feb+Mar
--                     (Jan+Feb already seeded in schema_v7; Mar in Resumen)
--   1D (Susana)    → $35k opening → owe Mar+Apr → paid Jan+Feb
--   1B (Walter)    → $70k opening → owe Feb+Mar+Apr → paid Jan only
--   2C (Silvana)   → $140k opening → owe Dec25+Jan+Feb+Mar+Apr → paid nothing
-- ============================================================

-- ── Susana (1D): paid January and February 2026 ─────────────
INSERT INTO payments (unit_id, amount, method, month, date, notes)
SELECT id, 35000, 'transferencia', '2026-01', '2026-01-15',
       'Historial — pago registrado retroactivamente'
FROM units
WHERE name = '1D'
  AND NOT EXISTS (
    SELECT 1 FROM payments p
    WHERE p.unit_id = units.id AND p.month = '2026-01'
  );

INSERT INTO payments (unit_id, amount, method, month, date, notes)
SELECT id, 35000, 'transferencia', '2026-02', '2026-02-15',
       'Historial — pago registrado retroactivamente'
FROM units
WHERE name = '1D'
  AND NOT EXISTS (
    SELECT 1 FROM payments p
    WHERE p.unit_id = units.id AND p.month = '2026-02'
  );

-- ── Walter (1B): paid January 2026 only ─────────────────────
INSERT INTO payments (unit_id, amount, method, month, date, notes)
SELECT id, 35000, 'transferencia', '2026-01', '2026-01-15',
       'Historial — pago registrado retroactivamente'
FROM units
WHERE name = '1B'
  AND NOT EXISTS (
    SELECT 1 FROM payments p
    WHERE p.unit_id = units.id AND p.month = '2026-01'
  );

-- ── Silvana (2C): no history — owes from December 2025 ──────
-- No inserts. Her debt starts at December 2025 with no prior payments.
