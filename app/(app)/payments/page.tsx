import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { currentMonth } from "@/lib/utils";
import PaymentsClient from "./PaymentsClient";

export default async function PaymentsPage() {
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
  const month = currentMonth();

  const [paymentsRes, unitsRes, feeRes, unitBalancesRes] = await Promise.all([
    // Payment history: admin sees all, resident sees own unit only
    isAdmin
      ? svc.from("payments").select("id, unit_id, amount, method, date, month, notes, receipt_url, units!inner(name)").order("date", { ascending: false }).limit(200)
      : svc.from("payments").select("id, unit_id, amount, method, date, month, notes, receipt_url, units!inner(name)").eq("unit_id", profile?.unit_id ?? "never").order("date", { ascending: false }),
    // All units for building-wide status (visible to everyone)
    svc.from("units").select("id, name, owner_name").order("name"),
    // Current month fee
    svc.from("monthly_fees").select("amount").eq("month", month).single(),
    // Opening balances (debt carried from previous month)
    svc.from("unit_balances").select("unit_id, opening_balance").eq("month", month),
  ]);

  // Current month payments grouped by unit, split by method
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

  // Opening balances keyed by unit_id
  const openingByUnit: Record<string, number> = {};
  for (const b of unitBalancesRes.data ?? []) {
    openingByUnit[b.unit_id] = Number(b.opening_balance);
  }

  // Normalize Supabase join (returns array or object depending on relation type)
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
      isAdmin={isAdmin}
      myUnitId={profile?.unit_id ?? null}
    />
  );
}
