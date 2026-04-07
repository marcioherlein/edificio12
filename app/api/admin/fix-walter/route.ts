import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST /api/admin/fix-walter
// 1. Deletes ALL Walter (1B) payments dated in April 2026 (clean slate)
// 2. Ensures April opening_balance = 70,000
// Idempotent.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Solo el administrador." }, { status: 403 });

  const svc = createServiceClient();

  const { data: unit, error: unitErr } = await svc
    .from("units").select("id, name, owner_name").eq("name", "1B").single();
  if (unitErr || !unit) return NextResponse.json({ error: "No se encontró unidad 1B." }, { status: 422 });

  const unitId = unit.id;

  // 1. Delete all April-dated payments for Walter
  const { data: aprilPayments } = await svc
    .from("payments")
    .select("id, amount, method, date, month")
    .eq("unit_id", unitId)
    .gte("date", "2026-04-01")
    .lt("date", "2026-05-01");

  const ids = (aprilPayments ?? []).map(p => p.id);
  if (ids.length > 0) {
    await svc.from("payments").delete().in("id", ids);
  }

  // 2. Ensure April opening_balance = 70,000
  const { data: existing } = await svc
    .from("unit_balances")
    .select("id, opening_balance")
    .eq("unit_id", unitId).eq("month", "2026-04")
    .maybeSingle();

  let aprBalAction = "";
  if (existing) {
    await svc.from("unit_balances")
      .update({ opening_balance: 70000 })
      .eq("unit_id", unitId).eq("month", "2026-04");
    aprBalAction = `updated ${existing.opening_balance} → 70000`;
  } else {
    await svc.from("unit_balances")
      .insert({ unit_id: unitId, month: "2026-04", opening_balance: 70000 });
    aprBalAction = "inserted 70000";
  }

  return NextResponse.json({
    ok: true,
    unit: `${unit.name} — ${unit.owner_name}`,
    deletedPayments: aprilPayments ?? [],
    aprBalAction,
    note: "Ahora podés agregar los 3 pagos manualmente desde la tabla de Abril.",
  });
}
