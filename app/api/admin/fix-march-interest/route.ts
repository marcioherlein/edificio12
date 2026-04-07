import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST /api/admin/fix-march-interest
// One-shot: sets March 2026 bank_interest=7422.55 and adjusts April bank_opening.
// Admin-only. Safe to call multiple times (idempotent).
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Solo el administrador." }, { status: 403 });

  const svc = createServiceClient();
  const MARCH = "2026-03";
  const APRIL = "2026-04";
  const INTEREST = 7422.55;

  // Read current March balances
  const { data: march, error: marchErr } = await svc
    .from("account_balances")
    .select("cash_opening, bank_opening, bank_interest")
    .eq("month", MARCH)
    .single();
  if (marchErr || !march) return NextResponse.json({ error: "No se encontró saldo de Marzo." }, { status: 422 });

  // Read March payments (by date) and expenses to recompute bankClosing
  const rangeStart = "2026-03-01";
  const rangeEnd   = "2026-04-01";

  const [paymentsRes, expensesRes, aprilRes] = await Promise.all([
    svc.from("payments").select("amount, method").gte("date", rangeStart).lt("date", rangeEnd),
    svc.from("expenses").select("amount, method").gte("date", rangeStart).lt("date", rangeEnd),
    svc.from("account_balances").select("bank_opening, cash_opening, bank_interest").eq("month", APRIL).single(),
  ]);

  const payments = paymentsRes.data ?? [];
  const expenses = expensesRes.data ?? [];

  const bankIn  = payments.filter(p => p.method === "transferencia").reduce((s, p) => s + Number(p.amount), 0);
  const cashIn  = payments.filter(p => p.method === "efectivo").reduce((s, p) => s + Number(p.amount), 0);
  const bankOut = expenses.filter(e => e.method !== "efectivo").reduce((s, e) => s + Number(e.amount), 0);
  const cashOut = expenses.filter(e => e.method === "efectivo").reduce((s, e) => s + Number(e.amount), 0);

  // Old bank closing (with whatever interest was stored before, likely 0)
  const oldInterest   = Number(march.bank_interest ?? 0);
  const oldBankClosing = Number(march.bank_opening) + bankIn + oldInterest - bankOut;
  const newBankClosing = Number(march.bank_opening) + bankIn + INTEREST - bankOut;
  const cashClosing    = Number(march.cash_opening) + cashIn - cashOut;
  const bankDelta      = newBankClosing - oldBankClosing; // +7422.55 if old was 0

  // 1. Update March bank_interest
  const { error: e1 } = await svc
    .from("account_balances")
    .update({ bank_interest: INTEREST })
    .eq("month", MARCH);
  if (e1) return NextResponse.json({ error: "Error actualizando Marzo: " + e1.message }, { status: 500 });

  // 2. Update April bank_opening (add the delta)
  const currentAprilBankOpening = Number(aprilRes.data?.bank_opening ?? 0);
  const { error: e2 } = await svc
    .from("account_balances")
    .update({ bank_opening: currentAprilBankOpening + bankDelta })
    .eq("month", APRIL);
  if (e2) return NextResponse.json({ error: "Error actualizando Abril: " + e2.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    march: {
      bank_interest: INTEREST,
      bank_closing_was: oldBankClosing,
      bank_closing_now: newBankClosing,
      cash_closing: cashClosing,
    },
    april: {
      bank_opening_was: currentAprilBankOpening,
      bank_opening_now: currentAprilBankOpening + bankDelta,
      delta: bankDelta,
    },
  });
}
