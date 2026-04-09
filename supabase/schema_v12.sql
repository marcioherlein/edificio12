-- ============================================================
-- Edificio 12 — Schema v12
-- Run in Supabase SQL Editor
-- ============================================================

-- Add notes column to expenses
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS notes text;

-- Replace system categories with canonical list
DELETE FROM expense_categories WHERE is_system = true;

INSERT INTO expense_categories (name, is_system) VALUES
  ('Limpieza',                              true),
  ('Productos de Limpieza',                 true),
  ('Administracion',                        true),
  ('Reparacion de porton',                  true),
  ('Corte de pasto',                        true),
  ('Luz/Electricidad (Edenor)',             true),
  ('Seguro',                                true),
  ('Reparaciones y mantenimiento generales',true)
ON CONFLICT (name) DO NOTHING;
