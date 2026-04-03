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

  const [paymentsRes, unitsRes, feeRes] = await Promise.all([
    // Payment history: admin sees all, resident sees own unit only
    isAdmin
      ? svc.from("payments").select("id, unit_id, amount, method, date, month, notes, receipt_url, units!inner(name)").order("created_at", { ascending: false }).limit(200)
      : svc.from("payments").select("id, unit_id, amount, method, date, month, notes, receipt_url, units!inner(name)").eq("unit_id", profile?.unit_id ?? "never").order("created_at", { ascending: false }),
    // All units for building-wide status (visible to everyone)
    svc.from("units").select("id, name, owner_name").order("name"),
    // Current month fee
    svc.from("monthly_fees").select("amount").eq("month", month).single(),
  ]);

  // Current month payments grouped by unit
  const { data: monthPayments } = await svc
    .from("payments")
    .select("unit_id, amount")
    .eq("month", month);

  const paidByUnit: Record<string, number> = {};
  for (const p of monthPayments ?? []) {
    paidByUnit[p.unit_id] = (paidByUnit[p.unit_id] ?? 0) + Number(p.amount);
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
      feeAmount={feeRes.data?.amount ?? 0}
      month={month}
      isAdmin={isAdmin}
      myUnitId={profile?.unit_id ?? null}
    />
  );
}
