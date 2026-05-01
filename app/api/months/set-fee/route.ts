import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { prevMonth } from "@/lib/utils";

// POST /api/months/set-fee
// Body: { month: string, amount: number }
// Sets the monthly fee for `month`. Requires the previous month to be closed.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin")
    return NextResponse.json({ error: "Solo el administrador." }, { status: 403 });

  const { month, amount } = await request.json() as { month: string; amount: number };

  if (!month || !/^\d{4}-\d{2}$/.test(month))
    return NextResponse.json({ error: "Mes inválido." }, { status: 400 });
  if (typeof amount !== "number" || amount <= 0)
    return NextResponse.json({ error: "Monto inválido." }, { status: 400 });

  const svc = createServiceClient();
  const prev = prevMonth(month);

  const { data: currentBal } = await svc
    .from("account_balances")
    .select("closed")
    .eq("month", month)
    .maybeSingle();

  if (currentBal?.closed) {
    return NextResponse.json(
      { error: `${month} ya está cerrado. No se puede modificar la expensa.` },
      { status: 409 }
    );
  }

  const { data: prevBal } = await svc
    .from("account_balances")
    .select("closed")
    .eq("month", prev)
    .maybeSingle();

  if (prevBal && !prevBal.closed) {
    return NextResponse.json(
      { error: `El mes anterior (${prev}) no está cerrado. Cerralo antes de configurar la expensa de este mes.` },
      { status: 422 }
    );
  }

  const { error } = await svc
    .from("monthly_fees")
    .upsert({ month, amount }, { onConflict: "month" });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
