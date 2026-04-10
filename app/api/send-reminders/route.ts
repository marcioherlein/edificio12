import { createServiceClient, createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { currentMonth, getPaymentStatus, formatCurrency } from "@/lib/utils";

export async function POST() {
  // ── Auth: admin session required ────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Solo el administrador." }, { status: 403 });
  // ────────────────────────────────────────────────────────────────────────────

  const resend = new Resend(process.env.RESEND_API_KEY ?? "");
  const svc = createServiceClient();
  const month = currentMonth();

  const [{ data: units }, { data: feeRow }] = await Promise.all([
    svc.from("units").select("id, name"),
    svc.from("monthly_fees").select("amount").eq("month", month).single(),
  ]);

  if (!feeRow) {
    return NextResponse.json({ error: "No hay expensa configurada para este mes." }, { status: 400 });
  }

  const feeAmount = Number(feeRow.amount);

  const { data: payments } = await svc
    .from("payments")
    .select("unit_id, amount")
    .eq("month", month);

  const paidByUnit: Record<string, number> = {};
  for (const p of payments ?? []) {
    paidByUnit[p.unit_id] = (paidByUnit[p.unit_id] ?? 0) + Number(p.amount);
  }

  const pendingUnitIds = (units ?? [])
    .filter((u) => getPaymentStatus(paidByUnit[u.id] ?? 0, feeAmount) !== "PAGADO")
    .map((u) => u.id);

  if (pendingUnitIds.length === 0) {
    return NextResponse.json({ sent: 0, message: "Todos los departamentos están al día." });
  }

  const { data: profiles } = await svc
    .from("profiles")
    .select("name, unit_id, id")
    .in("unit_id", pendingUnitIds)
    .eq("role", "resident");

  const emailMap: Record<string, string> = {};
  for (const p of profiles ?? []) {
    const { data: userData } = await svc.auth.admin.getUserById(p.id);
    if (userData.user?.email) {
      emailMap[p.id] = userData.user.email;
    }
  }

  const unitNames = Object.fromEntries((units ?? []).map((u) => [u.id, u.name]));

  let sent = 0;
  let failed = 0;

  for (const p of profiles ?? []) {
    const email = emailMap[p.id];
    if (!email) continue;

    const paid = paidByUnit[p.unit_id ?? ""] ?? 0;
    const status = getPaymentStatus(paid, feeAmount);
    const unitName = unitNames[p.unit_id ?? ""] ?? "";

    const { error } = await resend.emails.send({
      from: "Edificio 12 <noreply@edificio12.com>",
      to: [email],
      subject: `Recordatorio de expensa — ${month}`,
      text: `Hola ${p.name},\n\nTe recordamos que la expensa del mes ${month} del departamento ${unitName} se encuentra en estado: ${status}.\n\nMonto de la expensa: ${formatCurrency(feeAmount)}\nMonto abonado: ${formatCurrency(paid)}\n\nPor favor, regularizá tu situación a la brevedad.\n\nSaludos,\nAdministración Edificio 12`,
    });

    if (error) {
      console.error(`[send-reminders] Failed to send to profile ${p.id}:`, error);
      failed++;
    } else {
      sent++;
    }
  }

  return NextResponse.json({ sent, failed: failed > 0 ? failed : undefined });
}
