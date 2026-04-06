-- ============================================================
-- Edificio 12 — Schema v4 (April 2026 seed)
-- Run in Supabase SQL Editor
-- ============================================================

-- ── 1. Monthly fee — April 2026 ─────────────────────────────
INSERT INTO monthly_fees (month, amount)
VALUES ('2026-04', 35000.00)
ON CONFLICT (month) DO UPDATE SET amount = EXCLUDED.amount;


-- ── 2. Account opening balances — April 2026 ───────────────
-- Carries over March closing: Caja $325,070 · Uala $384,424.68
-- bank_interest: update once April interest is known
INSERT INTO account_balances (month, cash_opening, bank_opening, bank_interest, notes)
VALUES ('2026-04', 325070.00, 384424.68, 0, 'Saldo final Marzo 2026')
ON CONFLICT (month) DO UPDATE
  SET cash_opening  = EXCLUDED.cash_opening,
      bank_opening  = EXCLUDED.bank_opening,
      bank_interest = EXCLUDED.bank_interest,
      notes         = EXCLUDED.notes;


-- ── 3. Per-unit opening balances (Anterior) — April 2026 ───
-- Three units carried debt from March:
--   1B Walter G.  $35,000 ant. + $35,000 expensa − $0 paid = $70,000
--   1D Susana     $0 ant.      + $35,000 expensa − $0 paid = $35,000
--   2C Silvana    $105,000 ant.+ $35,000 expensa − $0 paid = $140,000
INSERT INTO unit_balances (unit_id, month, opening_balance)
SELECT u.id, '2026-04', t.balance
FROM (VALUES
  ('1B',   70000.00),
  ('1D',   35000.00),
  ('2C',  140000.00)
) AS t(unit_name, balance)
JOIN units u ON u.name = t.unit_name
ON CONFLICT (unit_id, month) DO UPDATE
  SET opening_balance = EXCLUDED.opening_balance;
