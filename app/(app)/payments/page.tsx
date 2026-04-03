import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { currentMonth } from "@/lib/utils";
import PaymentsClient from "./PaymentsClient";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, unit_id")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";
  const svc = createServiceClient();
  const params = await searchParams;
  const month = params.month ?? currentMonth();

  const [paymentsRes, unitsRes, feeRes, unitBalancesRes, availableMonthsRes] = await Promise.all([
    // Payment history for selected month: admin sees all, resident sees own unit only
    isAdmin
      ? svc.from("payments").select("id, unit_id, amount, method, date, month, notes, receipt_url, units!inner(name)").eq("month", month).order("date", { ascending: false })
      : svc.from("payments").select("id, unit_id, amount, method, date, month, notes, receipt_url, units!inner(name)").eq("unit_id", profile?.unit_id ?? "never").eq("month", month).order("date", { ascending: false }),
    // All units
    svc.from("units").select("id, name, owner_name").order("name"),
    // Fee for selected month
    svc.from("monthly_fees").select("amount").eq("month", month).single(),
    // Opening balances for selected month
    svc.from("unit_balances").select("unit_id, opening_balance").eq("month", month),
    // All months that have payments (for the month selector)
    svc.from("payments").select("month").order("month", { ascending: false }),
  ]);

  // Payments for selected month grouped by unit, split by method
  const { data: monthPayments } = await svc
    .from("payments")
    .select("unit_id, amount, method, date")
    .eq("month", month)
    .order("date", { ascending: true });

  const paidByUnit: Record<string, number> = {};
  const cashByUnit: Record<string, number> = {};
  const transferByUnit: Record<string, number> = {};
  const lastPaymentDateByUnit: Record<string, string> = {};

  for (const p of monthPayments ?? []) {
    paidByUnit[p.unit_id] = (paidByUnit[p.unit_id] ?? 0) + Number(p.amount);
    if (p.method === "efectivo") {
      cashByUnit[p.unit_id] = (cashByUnit[p.unit_id] ?? 0) + Number(p.amount);
    } else {
      transferByUnit[p.unit_id] = (transferByUnit[p.unit_id] ?? 0) + Number(p.amount);
    }
    lastPaymentDateByUnit[p.unit_id] = p.date;
  }

  const openingByUnit: Record<string, number> = {};
  for (const b of unitBalancesRes.data ?? []) {
    openingByUnit[b.unit_id] = Number(b.opening_balance);
  }

  // Unique sorted months for selector (include current month even if no payments yet)
  const monthSet = new Set<string>(
    (availableMonthsRes.data ?? []).map((r: any) => r.month)
  );
  monthSet.add(currentMonth());
  const availableMonths = Array.from(monthSet).sort().reverse();

  const payments = (paymentsRes.data ?? []).map((p: any) => ({
    ...p,
    units: Array.isArray(p.units) ? p.units[0] ?? null : p.units,
  }));

  return (
    <PaymentsClient
      payments={payments}
      units={unitsRes.data ?? []}
      paidByUnit={paidByUnit}
      cashByUnit={cashByUnit}
      transferByUnit={transferByUnit}
      lastPaymentDateByUnit={lastPaymentDateByUnit}
      openingByUnit={openingByUnit}
      feeAmount={feeRes.data?.amount ?? 0}
      month={month}
      availableMonths={availableMonths}
      isAdmin={isAdmin}
      myUnitId={profile?.unit_id ?? null}
    />
  );
}
