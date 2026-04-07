import { createClient, createServiceClient } from "@/lib/supabase/server";
import { currentMonth, nextMonth } from "@/lib/utils";
import ResumenClient from "./ResumenClient";

function nextMonthStr(month: string) {
  const [y, m] = month.split("-").map(Number);
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  return `${nextY}-${String(nextM).padStart(2, "0")}-01`;
}

export default async function ResumenPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles").select("role").eq("id", user.id).single();
    isAdmin = profile?.role === "admin";
  }

  const svc = createServiceClient();
  const params = await searchParams;
  const month = params.month ?? currentMonth();

  const [unitsRes, feeRes, accountBalRes, unitBalancesRes,
         paymentsByDateRes, paymentsByMonthRes,
         expensesRes, monthsRes, categoriesRes] =
    await Promise.all([
      svc.from("units").select("id, name, owner_name").order("name"),
      svc.from("monthly_fees").select("amount").eq("month", month).single(),
      svc.from("account_balances")
        .select("cash_opening, bank_opening, bank_interest")
        .eq("month", month).single(),
      svc.from("unit_balances").select("unit_id, opening_balance").eq("month", month),
      // Payments RECEIVED this calendar month (by date) — for cash balance accounting
      svc.from("payments").select("unit_id, amount, method")
        .gte("date", `${month}-01`)
        .lt("date", nextMonthStr(month)),
      // Payments ATTRIBUTED to this month (by month field) — for per-unit table & history
      svc.from("payments").select("id, unit_id, amount, method, month, date, notes, receipt_url")
        .eq("month", month)
        .order("date"),
      svc.from("expenses")
        .select("id, description, amount, method, date, category")
        .gte("date", `${month}-01`)
        .lt("date", nextMonthStr(month))
        .order("date"),
      svc.from("account_balances").select("month").order("month", { ascending: false }),
      svc.from("expense_categories").select("id, name").order("name"),
    ]);

  const openingByUnit: Record<string, number> = {};
  for (const b of unitBalancesRes.data ?? []) {
    openingByUnit[b.unit_id] = Number(b.opening_balance);
  }

  // Per-unit breakdown uses month-attributed payments (correct ledger logic)
  const cashByUnit: Record<string, number> = {};
  const transferByUnit: Record<string, number> = {};
  const lastDateByUnit: Record<string, string> = {};
  for (const p of paymentsByMonthRes.data ?? []) {
    if (p.method === "efectivo") {
      cashByUnit[p.unit_id] = (cashByUnit[p.unit_id] ?? 0) + Number(p.amount);
    } else {
      transferByUnit[p.unit_id] = (transferByUnit[p.unit_id] ?? 0) + Number(p.amount);
    }
    lastDateByUnit[p.unit_id] = p.date;
  }

  // Cash balance totals use date-received payments (correct accounting)
  const totalCashIn = (paymentsByDateRes.data ?? [])
    .filter(p => p.method === "efectivo")
    .reduce((s, p) => s + Number(p.amount), 0);
  const totalTransferIn = (paymentsByDateRes.data ?? [])
    .filter(p => p.method === "transferencia")
    .reduce((s, p) => s + Number(p.amount), 0);

  const payments = (paymentsByMonthRes.data ?? []).map((p: any) => ({
    id: p.id,
    unit_id: p.unit_id,
    amount: Number(p.amount),
    method: p.method as string,
    month: p.month as string,
    date: p.date as string,
    notes: p.notes as string | null,
    receipt_url: p.receipt_url as string | null,
  }));

  // Future months only visible to admin
  const monthSet = new Set((monthsRes.data ?? []).map((r: any) => r.month as string));
  monthSet.add(currentMonth());
  if (isAdmin) monthSet.add(nextMonth());
  const availableMonths = Array.from(monthSet).sort().reverse();

  const ab = accountBalRes.data;
  return (
    <ResumenClient
      month={month}
      availableMonths={availableMonths}
      units={unitsRes.data ?? []}
      feeAmount={Number(feeRes.data?.amount ?? 0)}
      openingByUnit={openingByUnit}
      cashByUnit={cashByUnit}
      transferByUnit={transferByUnit}
      lastDateByUnit={lastDateByUnit}
      totalCashIn={totalCashIn}
      totalTransferIn={totalTransferIn}
      payments={payments}
      expenses={(expensesRes.data ?? []).map((e: any) => ({ ...e, amount: Number(e.amount) }))}
      accountBalance={ab ? {
        cash_opening: Number(ab.cash_opening),
        bank_opening: Number(ab.bank_opening),
        bank_interest: Number((ab as any).bank_interest ?? 0),
      } : null}
      isAdmin={isAdmin}
      categories={categoriesRes.data ?? []}
    />
  );
}
