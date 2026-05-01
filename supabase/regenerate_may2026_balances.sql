-- ============================================================
-- Edificio 12 — Regenerar saldos de Mayo 2026
-- Recalcula unit_balances para 2026-05 a partir del cierre de Abril.
-- Ejecutar en Supabase SQL Editor (una sola vez)
-- ============================================================

DELETE FROM unit_balances WHERE month = '2026-05';

INSERT INTO unit_balances (unit_id, month, opening_balance)
SELECT
  u.id                                                              AS unit_id,
  '2026-05'                                                         AS month,
  COALESCE(ub.opening_balance, 0)
    + COALESCE(f.amount, 0)
    - COALESCE(paid.total, 0)                                       AS opening_balance
FROM units u
LEFT JOIN unit_balances ub ON ub.unit_id = u.id AND ub.month = '2026-04'
LEFT JOIN monthly_fees f   ON f.month = '2026-04'
LEFT JOIN (
  SELECT unit_id, SUM(amount) AS total
  FROM payments
  WHERE month = '2026-04'
  GROUP BY unit_id
) paid ON paid.unit_id = u.id
WHERE COALESCE(ub.opening_balance, 0)
    + COALESCE(f.amount, 0)
    - COALESCE(paid.total, 0) > 0;
