import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST /api/admin/fix-walter
// Fixes Walter (1B) April payments:
//   1. Finds ALL Walter payments dated in April (regardless of which month they're attributed to)
//   2. Re-attributes any Feb/Mar-attributed ones to month="2026-04"
//      (opening_balance already carries the accumulated Feb+Mar debt — all April payments must be month=Apr)
//   3. Sets April opening_balance = 70,000 if not already correct
// Idempotent.
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

  // 1. Find all April-dated payments for Walter
  const { data: aprilPayments } = await svc
    .from("payments")
    .select("id, amount, method, date, month")
    .eq("unit_id", unitId)
    .gte("date", "2026-04-01")
    .lt("date", "2026-05-01");

  const all = aprilPayments ?? [];

  // Re-attribute any payments not already on month="2026-04"
  const wrongMonth = all.filter(p => p.month !== "2026-04");
  const reattributed: typeof wrongMonth = [];
  for (const p of wrongMonth) {
    await svc.from("payments").update({ month: "2026-04" }).eq("id", p.id);
    reattributed.push(p);
  }

  // 2. Ensure April opening_balance = 70,000
  const { data: existingAprBal } = await svc
    .from("unit_balances")
    .select("id, opening_balance")
    .eq("unit_id", unitId)
    .eq("month", "2026-04")
    .maybeSingle();

  let aprBalAction = "";
  if (existingAprBal) {
    if (Number(existingAprBal.opening_balance) !== 70000) {
      await svc.from("unit_balances")
        .update({ opening_balance: 70000 })
        .eq("unit_id", unitId).eq("month", "2026-04");
      aprBalAction = `updated ${existingAprBal.opening_balance} → 70000`;
    } else {
      aprBalAction = "already 70000 ✓";
    }
  } else {
    await svc.from("unit_balances")
      .insert({ unit_id: unitId, month: "2026-04", opening_balance: 70000 });
    aprBalAction = "inserted 70000";
  }

  const totalPaid = all.reduce((s, p) => s + Number(p.amount), 0);

  return NextResponse.json({
    ok: true,
    unit: `${unit.name} — ${unit.owner_name}`,
    aprilPayments: all,
    reattributedToApril: reattributed,
    totalPaid,
    expectedSaldo: 70000 + 35000 - totalPaid,
    aprBalAction,
  });
}
