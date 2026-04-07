import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST /api/admin/fix-walter
// Fixes Walter (1B) data:
//   1. Deletes any payments for 1B with April+ dates attributed to closed months (Feb/Mar)
//   2. Sets 1B April opening_balance = 70,000 (35k feb debt + 35k mar fee, no payments in those months)
//   3. Inserts Walter's real payment: $105,000 transferencia, date 2026-04-03, month 2026-04
// Idempotent — checks before inserting.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Solo el administrador." }, { status: 403 });

  const svc = createServiceClient();

  // Find Walter's unit (1B)
  const { data: unit, error: unitErr } = await svc
    .from("units").select("id, name, owner_name").eq("name", "1B").single();
  if (unitErr || !unit) return NextResponse.json({ error: "No se encontró unidad 1B." }, { status: 422 });

  const unitId = unit.id;

  // 1. Delete incorrect payments: dated in April+ but attributed to closed months Feb/Mar
  const { data: badPayments } = await svc
    .from("payments")
    .select("id, amount, method, date, month")
    .eq("unit_id", unitId)
    .gte("date", "2026-04-01")
    .in("month", ["2026-02", "2026-03"]);

  const deletedIds = (badPayments ?? []).map(p => p.id);
  if (deletedIds.length > 0) {
    await svc.from("payments").delete().in("id", deletedIds);
  }

  // 2. Set April opening_balance = 70,000 for Walter
  //    (35k owed from Feb + 35k March fee, zero payments received in those months)
  const { data: existingAprBal } = await svc
    .from("unit_balances")
    .select("id, opening_balance")
    .eq("unit_id", unitId)
    .eq("month", "2026-04")
    .maybeSingle();

  let aprBalAction = "";
  if (existingAprBal) {
    await svc.from("unit_balances")
      .update({ opening_balance: 70000 })
      .eq("unit_id", unitId).eq("month", "2026-04");
    aprBalAction = `updated from ${existingAprBal.opening_balance} → 70000`;
  } else {
    await svc.from("unit_balances")
      .insert({ unit_id: unitId, month: "2026-04", opening_balance: 70000 });
    aprBalAction = "inserted 70000";
  }

  // 3. Insert Walter's $105,000 April payment (if not already present)
  const { data: existingPayment } = await svc
    .from("payments")
    .select("id, amount")
    .eq("unit_id", unitId)
    .eq("month", "2026-04")
    .eq("amount", 105000)
    .maybeSingle();

  let paymentAction = "";
  if (!existingPayment) {
    await svc.from("payments").insert({
      unit_id: unitId,
      amount: 105000,
      method: "transferencia",
      date: "2026-04-03",
      month: "2026-04",
      notes: "Cubre Feb + Mar + Abr",
    });
    paymentAction = "inserted $105,000 transferencia 2026-04-03";
  } else {
    paymentAction = "payment already exists, skipped";
  }

  return NextResponse.json({
    ok: true,
    unit: `${unit.name} — ${unit.owner_name}`,
    deletedBadPayments: badPayments ?? [],
    aprBalAction,
    paymentAction,
  });
}
