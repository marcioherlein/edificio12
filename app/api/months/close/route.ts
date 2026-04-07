import { createServiceClient } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function nextMonthStr(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  return `${nextY}-${String(nextM).padStart(2, "0")}`;
}

// POST /api/months/close
// Closes `sourceMonth` and writes opening balances for the following month.
// Callable by admin session OR by cron (Authorization: Bearer CRON_SECRET).
//
// Upsert rules:
//   account_balances for targetMonth:
//     - If row does not exist → INSERT cash/bank_opening, bank_interest=0
//     - If row exists         → UPDATE cash/bank_opening only (preserve bank_interest)
//   unit_balances for targetMonth:
//     - Delete all existing rows, then insert units with saldo > 0
export async function POST(request: Request) {
  // ── Auth ─────────────────────────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isCronCall = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isCronCall) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") return NextResponse.json({ error: "Solo el administrador." }, { status: 403 });
  }

  const { sourceMonth } = await request.json() as { sourceMonth: string };
  if (!sourceMonth || !/^\d{4}-\d{2}$/.test(sourceMonth)) {
    return NextResponse.json({ error: "sourceMonth inválido (formato YYYY-MM)." }, { status: 400 });
  }

  const targetMonth = nextMonthStr(sourceMonth);
  const svc = createServiceClient();

  const rangeStart = `${sourceMonth}-01`;
  const rangeEnd   = `${targetMonth}-01`; // exclusive upper bound

  // ── Fetch everything we need in parallel ─────────────────────────────────────
  const [accBalRes, paymentsByDateRes, paymentsByMonthRes, expensesRes, unitBalancesRes, feeRes, unitsRes] =
    await Promise.all([
      svc.from("account_balances")
        .select("cash_opening, bank_opening, bank_interest")
        .eq("month", sourceMonth).single(),
      // Payments RECEIVED in sourceMonth (by date) — for cash/bank account closing
      svc.from("payments")
        .select("unit_id, amount, method")
        .gte("date", rangeStart)
        .lt("date", rangeEnd),
      // Payments ATTRIBUTED to sourceMonth (by month field) — for per-unit saldo
      svc.from("payments")
        .select("unit_id, amount")
        .eq("month", sourceMonth),
      svc.from("expenses")
        .select("amount, method")
        .gte("date", rangeStart)
        .lt("date", rangeEnd),
      svc.from("unit_balances")
        .select("unit_id, opening_balance")
        .eq("month", sourceMonth),
      svc.from("monthly_fees").select("amount").eq("month", sourceMonth).single(),
      svc.from("units").select("id"),
    ]);

  if (!accBalRes.data) {
    return NextResponse.json(
      { error: `No hay saldo de apertura configurado para ${sourceMonth}. No se puede calcular el cierre.` },
      { status: 422 }
    );
  }

  // ── Compute account closing (date-based — cash flow accounting) ──────────────
  const src = accBalRes.data;
  const payments = paymentsByDateRes.data ?? [];
  const expenses  = expensesRes.data ?? [];

  const cashIn   = payments.filter(p => p.method === "efectivo").reduce((s, p) => s + Number(p.amount), 0);
  const bankIn   = payments.filter(p => p.method === "transferencia").reduce((s, p) => s + Number(p.amount), 0);
  const cashOut  = expenses.filter(e => e.method === "efectivo").reduce((s, e) => s + Number(e.amount), 0);
  const bankOut  = expenses.filter(e => e.method !== "efectivo").reduce((s, e) => s + Number(e.amount), 0);

  const cashClosing = Number(src.cash_opening) + cashIn - cashOut;
  const bankClosing = Number(src.bank_opening) + bankIn + Number(src.bank_interest ?? 0) - bankOut;

  // ── Upsert account_balances for targetMonth ───────────────────────────────────
  const computedNote = `Auto-computed from ${sourceMonth} on ${new Date().toISOString().slice(0, 10)}`;

  const { data: existingAb } = await svc
    .from("account_balances")
    .select("id, bank_interest")
    .eq("month", targetMonth)
    .maybeSingle();

  if (existingAb) {
    // Preserve bank_interest — only update the computed cash/bank opening
    await svc.from("account_balances").update({
      cash_opening: cashClosing,
      bank_opening: bankClosing,
      notes: computedNote,
    }).eq("month", targetMonth);
  } else {
    await svc.from("account_balances").insert({
      month: targetMonth,
      cash_opening: cashClosing,
      bank_opening: bankClosing,
      bank_interest: 0,
      notes: computedNote,
    });
  }

  // ── Compute per-unit saldo for sourceMonth (month-attributed payments) ────────
  const fee = Number(feeRes.data?.amount ?? 0);
  const openingByUnit: Record<string, number> = {};
  for (const b of unitBalancesRes.data ?? []) {
    openingByUnit[b.unit_id] = Number(b.opening_balance);
  }

  const paidByUnit: Record<string, number> = {};
  for (const p of paymentsByMonthRes.data ?? []) {
    paidByUnit[p.unit_id] = (paidByUnit[p.unit_id] ?? 0) + Number(p.amount);
  }

  const units = unitsRes.data ?? [];
  const newUnitBalances = units
    .map(u => ({
      unit_id: u.id,
      saldo: (openingByUnit[u.id] ?? 0) + fee - (paidByUnit[u.id] ?? 0),
    }))
    .filter(u => u.saldo > 0);

  // Delete + re-insert (clean upsert for unit_balances)
  await svc.from("unit_balances").delete().eq("month", targetMonth);
  if (newUnitBalances.length > 0) {
    await svc.from("unit_balances").insert(
      newUnitBalances.map(u => ({
        unit_id: u.unit_id,
        month: targetMonth,
        opening_balance: u.saldo,
      }))
    );
  }

  // ── Mark sourceMonth as closed ───────────────────────────────────────────────
  await svc.from("account_balances").update({ closed: true }).eq("month", sourceMonth);

  return NextResponse.json({
    ok: true,
    sourceMonth,
    targetMonth,
    computed: {
      cash_opening: cashClosing,
      bank_opening: bankClosing,
      unit_balances: newUnitBalances.map(u => ({ unit_id: u.unit_id, opening: u.saldo })),
    },
  });
}
