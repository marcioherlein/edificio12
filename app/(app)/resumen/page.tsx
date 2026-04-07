import { createClient, createServiceClient } from "@/lib/supabase/server";
import { currentMonth, nextMonth } from "@/lib/utils";
import ResumenClient from "./ResumenClient";

function nextMonthStr(month: string) {
  const [y, m] = month.split("-").map(Number);
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  return `${nextY}-${String(nextM).padStart(2, "0")}-01`;
}

function unitSortKey(name: string): string {
  if (name.startsWith("PB")) return `0_${name}`;
  return `1_${name}`;
}

function sortUnits<T extends { name: string }>(units: T[]): T[] {
  return [...units].sort((a, b) => unitSortKey(a.name).localeCompare(unitSortKey(b.name)));
}

/** A month is "open" if it's the current month, or the previous month within the 5-day grace period. */
function isMonthOpen(month: string): boolean {
  const now = new Date();
  const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  if (month === cur) return true;
  if (now.getDate() <= 5) {
    const prevY = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const prevM = now.getMonth() === 0 ? 12 : now.getMonth();
    const prev = `${prevY}-${String(prevM).padStart(2, "0")}`;
    if (month === prev) return true;
  }
  return false;
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
      svc.from("units").select("id, name, owner_name"),
      svc.from("monthly_fees").select("amount").eq("month", month).single(),
      svc.from("account_balances")
        .select("cash_opening, bank_opening, bank_interest, closed")
        .eq("month", month).single(),
      svc.from("unit_balances").select("unit_id, opening_balance").eq("month", month),
      // Payments RECEIVED this calendar month (by date) — used for cash balance AND as frozen ledger for closed months
      svc.from("payments").select("id, unit_id, amount, method, month, date, notes, receipt_url")
        .gte("date", `${month}-01`)
        .lt("date", nextMonthStr(month))
        .order("date"),
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

  const isClosed = !!(accountBalRes.data as any)?.closed || !isMonthOpen(month);

  // Always use DATE-bounded payments for per-unit display.
  // A payment belongs to the month it was physically received, regardless of which
  // period it covers (month field). The opening_balance handles accumulated debt.
  // This means: Walter pays 3×$35k in April → all 3 show in April → saldo $0.
  const ledgerPayments = paymentsByDateRes.data ?? [];

  const cashByUnit: Record<string, number> = {};
  const transferByUnit: Record<string, number> = {};
  const lastDateByUnit: Record<string, string> = {};
  for (const p of ledgerPayments) {
    if (p.method === "efectivo") {
      cashByUnit[p.unit_id] = (cashByUnit[p.unit_id] ?? 0) + Number(p.amount);
    } else {
      transferByUnit[p.unit_id] = (transferByUnit[p.unit_id] ?? 0) + Number(p.amount);
    }
    if (p.date) lastDateByUnit[p.unit_id] = p.date;
  }

  // Cash balance totals use date-received payments (correct accounting)
  const totalCashIn = (paymentsByDateRes.data ?? [])
    .filter(p => p.method === "efectivo")
    .reduce((s, p) => s + Number(p.amount), 0);
  const totalTransferIn = (paymentsByDateRes.data ?? [])
    .filter(p => p.method === "transferencia")
    .reduce((s, p) => s + Number(p.amount), 0);

  // Expanded detail also date-bounded — consistent with ledger display
  const detailPayments = (paymentsByDateRes.data ?? []).map((p: any) => ({
    id: p.id ?? "",
    unit_id: p.unit_id,
    amount: Number(p.amount),
    method: p.method as string,
    month: p.month ?? month,
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
      units={sortUnits(unitsRes.data ?? [])}
      feeAmount={Number(feeRes.data?.amount ?? 0)}
      openingByUnit={openingByUnit}
      cashByUnit={cashByUnit}
      transferByUnit={transferByUnit}
      lastDateByUnit={lastDateByUnit}
      totalCashIn={totalCashIn}
      totalTransferIn={totalTransferIn}
      payments={detailPayments}
      expenses={(expensesRes.data ?? []).map((e: any) => ({ ...e, amount: Number(e.amount) }))}
      accountBalance={ab ? {
        cash_opening: Number(ab.cash_opening),
        bank_opening: Number(ab.bank_opening),
        bank_interest: Number((ab as any).bank_interest ?? 0),
      } : null}
      isAdmin={isAdmin}
      isClosed={isClosed}
      categories={categoriesRes.data ?? []}
    />
  );
}
