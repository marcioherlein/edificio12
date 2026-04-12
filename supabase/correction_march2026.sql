-- ============================================================
-- Edificio 12 — Corrección histórica Marzo 2026
-- Ejecutar en Supabase SQL Editor (una sola vez)
--
-- Qué hace este script:
--   1. Fija cash_opening de Marzo en $255.070
--   2. Borra los pagos de Fabiana atribuidos a Marzo
--   3. Recalcula el cierre de caja de Marzo
--   4. Actualiza la apertura de caja de Abril con el cierre corregido
--   5. Recalcula el saldo adeudado de Fabiana en Abril
--        (March fee + deuda anterior, ya que no pagó)
--   6. Borra todos los pagos de Fabiana atribuidos a Abril
--   7. Si existe apertura de Mayo, la actualiza también
--   8. Elimina el reporte HTML de Marzo (quedó desactualizado;
--      regenerarlo desde el panel admin)
-- ============================================================

DO $$
DECLARE
  fabiana_unit_id       uuid;
  v_march               text := '2026-03';
  v_april               text := '2026-04';
  v_may                 text := '2026-05';

  v_cash_opening_march  numeric := 255070;

  v_march_cash_in       numeric;
  v_march_cash_out      numeric;
  v_march_cash_closing  numeric;

  v_april_cash_opening  numeric;
  v_april_cash_in       numeric;
  v_april_cash_out      numeric;
  v_april_cash_closing  numeric;

  v_march_fee           numeric;
  v_fabiana_march_open  numeric;
  v_fabiana_april_open  numeric;

  v_deleted_march       int;
  v_deleted_april       int;
BEGIN

  -- ── 0. Encontrar la unidad de Fabiana ────────────────────────────────────
  SELECT id INTO fabiana_unit_id
  FROM units
  WHERE owner_name ILIKE '%fabiana%'
  LIMIT 1;

  IF fabiana_unit_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró ninguna unidad con owner_name LIKE fabiana. Verificar la tabla units.';
  END IF;
  RAISE NOTICE '>>> Unidad de Fabiana: %', fabiana_unit_id;


  -- ── 1. Corregir apertura de caja de Marzo ────────────────────────────────
  UPDATE account_balances
  SET cash_opening = v_cash_opening_march,
      closed = false,   -- re-abrir temporalmente para corrección
      notes = 'Corregido manualmente: apertura = 255070 (corrección histórica)'
  WHERE month = v_march;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe fila en account_balances para 2026-03. Verificar la tabla.';
  END IF;
  RAISE NOTICE '>>> account_balances[2026-03] cash_opening → $%', v_cash_opening_march;


  -- ── 2. Borrar pagos de Fabiana en Marzo ──────────────────────────────────
  DELETE FROM payments
  WHERE unit_id = fabiana_unit_id
    AND month = v_march;
  GET DIAGNOSTICS v_deleted_march = ROW_COUNT;
  RAISE NOTICE '>>> Pagos de Fabiana eliminados (month=2026-03): %', v_deleted_march;


  -- ── 3. Recalcular cierre de caja de Marzo ────────────────────────────────
  --   Mismo criterio que el close route:
  --     cash_in  = pagos efectivo cuya DATE cae en marzo
  --     cash_out = gastos efectivo cuya DATE cae en marzo
  SELECT COALESCE(SUM(amount), 0) INTO v_march_cash_in
  FROM payments
  WHERE date >= '2026-03-01'::date
    AND date <  '2026-04-01'::date
    AND method = 'efectivo';

  SELECT COALESCE(SUM(amount), 0) INTO v_march_cash_out
  FROM expenses
  WHERE date >= '2026-03-01'::date
    AND date <  '2026-04-01'::date
    AND method = 'efectivo';

  v_march_cash_closing := v_cash_opening_march + v_march_cash_in - v_march_cash_out;

  RAISE NOTICE '>>> Marzo — cash_in: $%  |  cash_out: $%  |  cierre caja: $%',
    v_march_cash_in, v_march_cash_out, v_march_cash_closing;

  -- Volver a cerrar Marzo
  UPDATE account_balances
  SET closed = true
  WHERE month = v_march;


  -- ── 4. Actualizar apertura de caja de Abril ──────────────────────────────
  UPDATE account_balances
  SET cash_opening = v_march_cash_closing,
      notes = 'Recalculado desde cierre corregido de 2026-03'
  WHERE month = v_april;

  IF NOT FOUND THEN
    RAISE WARNING 'No existe fila en account_balances para 2026-04. Se debería crear con cash_opening=%.', v_march_cash_closing;
  ELSE
    RAISE NOTICE '>>> account_balances[2026-04] cash_opening → $%', v_march_cash_closing;
  END IF;


  -- ── 5. Recalcular saldo adeudado de Fabiana en Abril ────────────────────
  --   Fabiana no pagó en Marzo → su deuda al inicio de Abril:
  --   opening_abril = opening_marzo + fee_marzo
  SELECT COALESCE(amount, 0) INTO v_march_fee
  FROM monthly_fees
  WHERE month = v_march;

  SELECT COALESCE(opening_balance, 0) INTO v_fabiana_march_open
  FROM unit_balances
  WHERE unit_id = fabiana_unit_id
    AND month = v_march;

  v_fabiana_april_open := v_fabiana_march_open + v_march_fee;

  INSERT INTO unit_balances (unit_id, month, opening_balance)
  VALUES (fabiana_unit_id, v_april, v_fabiana_april_open)
  ON CONFLICT (unit_id, month)
    DO UPDATE SET opening_balance = EXCLUDED.opening_balance;

  RAISE NOTICE '>>> unit_balances[Fabiana, 2026-04] opening_balance → $%  (anterior=$% + fee=$%)',
    v_fabiana_april_open, v_fabiana_march_open, v_march_fee;


  -- ── 6. Borrar pagos de Fabiana en Abril ─────────────────────────────────
  DELETE FROM payments
  WHERE unit_id = fabiana_unit_id
    AND month = v_april;
  GET DIAGNOSTICS v_deleted_april = ROW_COUNT;
  RAISE NOTICE '>>> Pagos de Fabiana eliminados (month=2026-04): %', v_deleted_april;


  -- ── 7. Propagar a Mayo si ya existe ─────────────────────────────────────
  IF EXISTS (SELECT 1 FROM account_balances WHERE month = v_may) THEN

    SELECT cash_opening INTO v_april_cash_opening
    FROM account_balances WHERE month = v_april;

    SELECT COALESCE(SUM(amount), 0) INTO v_april_cash_in
    FROM payments
    WHERE date >= '2026-04-01'::date
      AND date <  '2026-05-01'::date
      AND method = 'efectivo';

    SELECT COALESCE(SUM(amount), 0) INTO v_april_cash_out
    FROM expenses
    WHERE date >= '2026-04-01'::date
      AND date <  '2026-05-01'::date
      AND method = 'efectivo';

    v_april_cash_closing := v_april_cash_opening + v_april_cash_in - v_april_cash_out;

    UPDATE account_balances
    SET cash_opening = v_april_cash_closing,
        notes = 'Recalculado desde cierre corregido de 2026-04'
    WHERE month = v_may;

    RAISE NOTICE '>>> account_balances[2026-05] cash_opening → $%', v_april_cash_closing;

  ELSE
    RAISE NOTICE '>>> No existe fila para 2026-05, no se actualiza (esperado si Abril no está cerrado aún).';
  END IF;


  -- ── 8. Invalidar reporte HTML de Marzo ──────────────────────────────────
  DELETE FROM monthly_reports WHERE month = v_march;
  RAISE NOTICE '>>> Reporte HTML de 2026-03 eliminado. REGENERARLO desde el panel admin.';


  RAISE NOTICE '';
  RAISE NOTICE '=== Corrección completada ===';
  RAISE NOTICE '  Apertura caja Marzo   : $255.070';
  RAISE NOTICE '  Cierre caja Marzo     : $%', v_march_cash_closing;
  RAISE NOTICE '  Apertura caja Abril   : $%', v_march_cash_closing;
  RAISE NOTICE '  Deuda Fabiana Abril   : $%', v_fabiana_april_open;
  RAISE NOTICE '  Pagos Marzo borrados  : %', v_deleted_march;
  RAISE NOTICE '  Pagos Abril borrados  : %', v_deleted_april;
  RAISE NOTICE '  PENDIENTE: regenerar reporte de Marzo desde el panel admin.';

END $$;
