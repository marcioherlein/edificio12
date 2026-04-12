-- ============================================================
-- Edificio 12 — Corrección histórica Marzo 2026
-- Ejecutar en Supabase SQL Editor (una sola vez)
--
-- Correcciones incluidas:
--   1. Fija cash_opening de Marzo en $255.070
--   2. Fija bank_interest de Marzo (Ualá) en $7.422,55
--   3. Borra los pagos de Fabiana atribuidos a Marzo
--   4. Recalcula el cierre de CAJA de Marzo
--   5. Recalcula el cierre de UALÁ de Marzo
--   6. Actualiza apertura de caja y Ualá de Abril con los cierres corregidos
--   7. Recalcula el saldo adeudado de Fabiana en Abril
--        (deuda anterior + fee de Marzo, ya que no pagó)
--   8. Borra todos los pagos de Fabiana atribuidos a Abril
--   9. Si existe apertura de Mayo, la actualiza también
--  10. Elimina el reporte HTML de Marzo (quedó desactualizado;
--      regenerarlo desde el panel admin)
-- ============================================================

DO $$
DECLARE
  fabiana_unit_id         uuid;
  v_march                 text    := '2026-03';
  v_april                 text    := '2026-04';
  v_may                   text    := '2026-05';

  -- ── Valores corregidos ──────────────────────────────────────────────────
  v_cash_opening_march    numeric := 255070;
  v_bank_interest_march   numeric := 7422.55;

  -- ── Caja (efectivo) ─────────────────────────────────────────────────────
  v_march_cash_in         numeric;
  v_march_cash_out        numeric;
  v_march_cash_closing    numeric;

  -- ── Ualá (transferencia) ────────────────────────────────────────────────
  v_march_bank_opening    numeric;
  v_march_bank_in         numeric;
  v_march_bank_out        numeric;
  v_march_bank_closing    numeric;

  -- ── Propagación a Abril y Mayo ──────────────────────────────────────────
  v_april_cash_opening    numeric;
  v_april_bank_opening    numeric;
  v_april_cash_in         numeric;
  v_april_cash_out        numeric;
  v_april_cash_closing    numeric;
  v_april_bank_in         numeric;
  v_april_bank_out        numeric;
  v_april_bank_closing    numeric;
  v_april_bank_interest   numeric;

  -- ── Deuda Fabiana ───────────────────────────────────────────────────────
  v_march_fee             numeric;
  v_fabiana_march_open    numeric;
  v_fabiana_april_open    numeric;

  v_deleted_march         int;
  v_deleted_april         int;
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


  -- ── 1. Corregir apertura de caja e intereses Ualá de Marzo ──────────────
  SELECT bank_opening INTO v_march_bank_opening
  FROM account_balances
  WHERE month = v_march;

  UPDATE account_balances
  SET cash_opening  = v_cash_opening_march,
      bank_interest = v_bank_interest_march,
      closed        = false,   -- re-abrir temporalmente para corrección
      notes         = 'Corregido manualmente: cash_opening=255070, bank_interest=7422.55'
  WHERE month = v_march;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe fila en account_balances para 2026-03. Verificar la tabla.';
  END IF;
  RAISE NOTICE '>>> account_balances[2026-03] cash_opening → $%  |  bank_interest → $%',
    v_cash_opening_march, v_bank_interest_march;


  -- ── 2. Borrar pagos de Fabiana en Marzo ──────────────────────────────────
  DELETE FROM payments
  WHERE unit_id = fabiana_unit_id
    AND month = v_march;
  GET DIAGNOSTICS v_deleted_march = ROW_COUNT;
  RAISE NOTICE '>>> Pagos de Fabiana eliminados (month=2026-03): %', v_deleted_march;


  -- ── 3. Recalcular cierre de CAJA de Marzo ────────────────────────────────
  --   cash_in  = pagos efectivo cuya DATE cae en Marzo (ya sin Fabiana)
  --   cash_out = gastos efectivo cuya DATE cae en Marzo
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

  RAISE NOTICE '>>> Caja Marzo — in: $%  |  out: $%  |  cierre: $%',
    v_march_cash_in, v_march_cash_out, v_march_cash_closing;


  -- ── 4. Recalcular cierre de UALÁ de Marzo ────────────────────────────────
  --   bank_in  = pagos transferencia cuya DATE cae en Marzo
  --   bank_out = gastos NO-efectivo cuya DATE cae en Marzo
  SELECT COALESCE(SUM(amount), 0) INTO v_march_bank_in
  FROM payments
  WHERE date >= '2026-03-01'::date
    AND date <  '2026-04-01'::date
    AND method = 'transferencia';

  SELECT COALESCE(SUM(amount), 0) INTO v_march_bank_out
  FROM expenses
  WHERE date >= '2026-03-01'::date
    AND date <  '2026-04-01'::date
    AND method != 'efectivo';

  v_march_bank_closing := v_march_bank_opening
                        + v_march_bank_in
                        + v_bank_interest_march
                        - v_march_bank_out;

  RAISE NOTICE '>>> Ualá Marzo  — opening: $%  |  in: $%  |  intereses: $%  |  out: $%  |  cierre: $%',
    v_march_bank_opening, v_march_bank_in, v_bank_interest_march, v_march_bank_out, v_march_bank_closing;

  -- Volver a cerrar Marzo
  UPDATE account_balances
  SET closed = true
  WHERE month = v_march;


  -- ── 5. Actualizar apertura de Abril (caja + Ualá) ────────────────────────
  UPDATE account_balances
  SET cash_opening = v_march_cash_closing,
      bank_opening = v_march_bank_closing,
      notes        = 'Recalculado desde cierre corregido de 2026-03'
  WHERE month = v_april;

  IF NOT FOUND THEN
    RAISE WARNING 'No existe fila en account_balances para 2026-04.';
  ELSE
    RAISE NOTICE '>>> account_balances[2026-04] cash_opening → $%  |  bank_opening → $%',
      v_march_cash_closing, v_march_bank_closing;
  END IF;


  -- ── 6. Recalcular saldo adeudado de Fabiana en Abril ────────────────────
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

  RAISE NOTICE '>>> unit_balances[Fabiana, 2026-04] → $%  (anterior=$% + fee=$%)',
    v_fabiana_april_open, v_fabiana_march_open, v_march_fee;


  -- ── 7. Borrar pagos de Fabiana en Abril ─────────────────────────────────
  DELETE FROM payments
  WHERE unit_id = fabiana_unit_id
    AND month = v_april;
  GET DIAGNOSTICS v_deleted_april = ROW_COUNT;
  RAISE NOTICE '>>> Pagos de Fabiana eliminados (month=2026-04): %', v_deleted_april;


  -- ── 8. Propagar a Mayo si ya existe ─────────────────────────────────────
  IF EXISTS (SELECT 1 FROM account_balances WHERE month = v_may) THEN

    SELECT cash_opening, bank_opening, COALESCE(bank_interest, 0)
      INTO v_april_cash_opening, v_april_bank_opening, v_april_bank_interest
    FROM account_balances WHERE month = v_april;

    SELECT COALESCE(SUM(amount), 0) INTO v_april_cash_in
    FROM payments
    WHERE date >= '2026-04-01'::date AND date < '2026-05-01'::date AND method = 'efectivo';

    SELECT COALESCE(SUM(amount), 0) INTO v_april_cash_out
    FROM expenses
    WHERE date >= '2026-04-01'::date AND date < '2026-05-01'::date AND method = 'efectivo';

    SELECT COALESCE(SUM(amount), 0) INTO v_april_bank_in
    FROM payments
    WHERE date >= '2026-04-01'::date AND date < '2026-05-01'::date AND method = 'transferencia';

    SELECT COALESCE(SUM(amount), 0) INTO v_april_bank_out
    FROM expenses
    WHERE date >= '2026-04-01'::date AND date < '2026-05-01'::date AND method != 'efectivo';

    v_april_cash_closing := v_april_cash_opening + v_april_cash_in - v_april_cash_out;
    v_april_bank_closing := v_april_bank_opening + v_april_bank_in + v_april_bank_interest - v_april_bank_out;

    UPDATE account_balances
    SET cash_opening = v_april_cash_closing,
        bank_opening = v_april_bank_closing,
        notes        = 'Recalculado desde cierre corregido de 2026-04'
    WHERE month = v_may;

    RAISE NOTICE '>>> account_balances[2026-05] cash_opening → $%  |  bank_opening → $%',
      v_april_cash_closing, v_april_bank_closing;

  ELSE
    RAISE NOTICE '>>> No existe fila para 2026-05 (esperado: Abril aún no cerrado).';
  END IF;


  -- ── 9. Invalidar reporte HTML de Marzo ──────────────────────────────────
  DELETE FROM monthly_reports WHERE month = v_march;
  RAISE NOTICE '>>> Reporte HTML de 2026-03 eliminado. REGENERARLO desde el panel admin.';


  RAISE NOTICE '';
  RAISE NOTICE '=== RESUMEN DE CORRECCIONES ===';
  RAISE NOTICE '  Apertura caja Marzo     : $255.070,00';
  RAISE NOTICE '  Intereses Ualá Marzo    : $7.422,55';
  RAISE NOTICE '  Cierre caja Marzo       : $%', v_march_cash_closing;
  RAISE NOTICE '  Cierre Ualá Marzo       : $%', v_march_bank_closing;
  RAISE NOTICE '  Apertura caja Abril     : $%', v_march_cash_closing;
  RAISE NOTICE '  Apertura Ualá Abril     : $%', v_march_bank_closing;
  RAISE NOTICE '  Deuda Fabiana en Abril  : $%', v_fabiana_april_open;
  RAISE NOTICE '  Pagos Marzo eliminados  : %', v_deleted_march;
  RAISE NOTICE '  Pagos Abril eliminados  : %', v_deleted_april;
  RAISE NOTICE '  PENDIENTE: regenerar reporte de Marzo desde el panel admin.';

END $$;
