-- ============================================================
-- Edificio 12 — Schema v3 (unit_balances + March 2026 seed)
-- Run AFTER schema.sql and schema_v2.sql in Supabase SQL Editor
-- ============================================================

-- ── 1. unit_balances table ──────────────────────────────────
-- Tracks per-unit opening balance (deuda anterior) per month.
-- This is what populates the "Anterior" column in the liquidación.
CREATE TABLE IF NOT EXISTS unit_balances (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id         uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  month           text NOT NULL,                          -- "2026-03"
  opening_balance numeric(12,2) NOT NULL DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(unit_id, month)
);

ALTER TABLE unit_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read" ON unit_balances;
CREATE POLICY "authenticated_read" ON unit_balances
  FOR SELECT USING (auth.role() = 'authenticated');


-- ── 2. Re-seed units with correct building layout ──────────
-- Building: PB (4 units), 1° (4 units), 2° (4 units) = 12 total.
-- Clears placeholder units before inserting real data.
DELETE FROM payments;
DELETE FROM units;

INSERT INTO units (name, owner_name) VALUES
  ('PB A', 'Marilina'),
  ('PB B', 'Fabiana'),
  ('PB C', 'Nilda Z.'),
  ('PB D', 'Hugo G.'),
  ('1A',   'Sofía S.'),
  ('1B',   'Walter G.'),
  ('1C',   'Lorena'),
  ('1D',   'Susana'),
  ('2A',   'Mariela'),
  ('2B',   'Milena'),
  ('2C',   'Silvana'),
  ('2D',   'Magdalena');


-- ── 3. Monthly fee — March 2026 ─────────────────────────────
INSERT INTO monthly_fees (month, amount)
VALUES ('2026-03', 35000.00)
ON CONFLICT (month) DO UPDATE SET amount = EXCLUDED.amount;


-- ── 4. Account opening balances — March 2026 ───────────────
-- End-of-February totals become the March opening balance.
-- bank_interest: Uala generated interest tracked separately from payments.
ALTER TABLE account_balances ADD COLUMN IF NOT EXISTS
  bank_interest numeric(12,2) NOT NULL DEFAULT 0;

INSERT INTO account_balances (month, cash_opening, bank_opening, bank_interest, notes)
VALUES ('2026-03', 255070.00, 304582.56, 7422.55, 'Saldo final Febrero 2026')
ON CONFLICT (month) DO UPDATE
  SET cash_opening  = EXCLUDED.cash_opening,
      bank_opening  = EXCLUDED.bank_opening,
      bank_interest = EXCLUDED.bank_interest,
      notes         = EXCLUDED.notes;


-- ── 5. Per-unit opening balances (Anterior) — March 2026 ───
-- Only units with a non-zero anterior balance are listed.
-- Units not listed here carry $0 into March.
INSERT INTO unit_balances (unit_id, month, opening_balance)
SELECT u.id, '2026-03', t.balance
FROM (VALUES
  ('PB A',  35000.00),
  ('PB D',  70000.00),
  ('1B',    35000.00),
  ('1C',    35000.00),
  ('2C',   105000.00)
) AS t(unit_name, balance)
JOIN units u ON u.name = t.unit_name
ON CONFLICT (unit_id, month) DO UPDATE
  SET opening_balance = EXCLUDED.opening_balance;


-- ── 6. Payments — March 2026 ────────────────────────────────
-- 9 units paid; 3 units (1B Walter, 1D Susana, 2C Silvana) did not pay.
-- Totals: $105,000 efectivo · $350,000 transferencia = $455,000 recaudado
INSERT INTO payments (unit_id, amount, method, date, month)
SELECT u.id, t.amount, t.method, t.pay_date::date, '2026-03'
FROM (VALUES
  ('PB A', 70000.00,  'transferencia', '2026-03-05'),
  ('PB B', 35000.00,  'efectivo',      '2026-03-31'),
  ('PB C', 35000.00,  'efectivo',      '2026-03-01'),
  ('PB D', 105000.00, 'transferencia', '2026-03-11'),
  ('1A',   35000.00,  'transferencia', '2026-03-11'),
  ('1C',   70000.00,  'transferencia', '2026-03-04'),
  ('2A',   35000.00,  'transferencia', '2026-03-09'),
  ('2B',   35000.00,  'efectivo',      '2026-03-01'),
  ('2D',   35000.00,  'transferencia', '2026-03-17')
) AS t(unit_name, amount, method, pay_date)
JOIN units u ON u.name = t.unit_name;


-- ── 7. Expenses (Egresos) — March 2026 ──────────────────────
-- Totals: $35,000 efectivo · $277,580.43 transferencia = $312,580.43
-- Dates: taken from descriptions where explicit; otherwise estimated.
DELETE FROM expenses;

INSERT INTO expenses (description, amount, method, date, category) VALUES
  ('Seguro Póliza nº 40,399,087 La Segunda — cuota 2/6',
      35992.00, 'transferencia', '2026-03-01', 'Seguro'),
  ('Edenor — Factura A',
      37388.43, 'transferencia', '2026-03-15', 'Luz / Electricidad (Edenor)'),
  ('Limpieza Marzo (5/3 · 13/3 · 19/3 · 26/3)',
     110000.00, 'transferencia', '2026-03-26', 'Limpieza'),
  ('Gastos de Administración',
      35000.00, 'efectivo',      '2026-03-31', 'Administración'),
  ('Corte de pasto',
      67000.00, 'transferencia', '2026-03-02', 'Corte de pasto'),
  ('Productos de limpieza',
      27200.00, 'transferencia', '2026-03-12', 'Productos de limpieza');
