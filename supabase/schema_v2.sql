-- ============================================================
-- Edificio 12 — Schema v2 (migration)
-- Run this AFTER schema.sql in the Supabase SQL Editor
-- ============================================================

-- Add method + receipt to expenses
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS method text
  CHECK (method IN ('efectivo', 'transferencia')) DEFAULT 'transferencia';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_url text;

-- Expense categories (preset + custom)
CREATE TABLE IF NOT EXISTS expense_categories (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_system boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

INSERT INTO expense_categories (name, is_system) VALUES
  ('Seguro',                          true),
  ('Luz / Electricidad (Edenor)',      true),
  ('Limpieza',                         true),
  ('Administración',                   true),
  ('Corte de pasto',                   true),
  ('Productos de limpieza',            true),
  ('Reparaciones y Mantenimiento',     true),
  ('Plomería',                         true),
  ('Ascensor',                         true),
  ('Portero / Encargado',              true),
  ('Expensas extraordinarias',         true),
  ('Otros',                            true)
ON CONFLICT (name) DO NOTHING;

-- Opening balances per month (Caja + Cta. Ualá)
-- Set once by admin at the start of each month
CREATE TABLE IF NOT EXISTS account_balances (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month        text NOT NULL UNIQUE,       -- "2026-03"
  cash_opening numeric(12,2) NOT NULL DEFAULT 0,
  bank_opening numeric(12,2) NOT NULL DEFAULT 0,
  notes        text,
  created_at   timestamptz DEFAULT now()
);

-- Monthly reports (stored HTML + JSON summary)
CREATE TABLE IF NOT EXISTS monthly_reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month        text NOT NULL UNIQUE,
  report_html  text,
  summary      jsonb,
  generated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_balances   ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_reports    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read" ON expense_categories
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "authenticated_read" ON account_balances
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "authenticated_read" ON monthly_reports
  FOR SELECT USING (auth.role() = 'authenticated');
