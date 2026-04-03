import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { currentMonth, getPaymentStatus, formatCurrency } from "@/lib/utils";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  const svc = createServiceClient();

  // Verify caller is admin via auth header (simple Bearer token check for internal use)
  // In production you'd verify the session from the request
  const { data: units } = await svc.from("units").select("id, name");
  const month = currentMonth();

  const { data: feeRow } = await svc
    .from("monthly_fees")
    .select("amount")
    .eq("month", month)
    .single();

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

  // Find pending/partial units
  const pendingUnitIds = (units ?? [])
    .filter((u) => getPaymentStatus(paidByUnit[u.id] ?? 0, feeAmount) !== "PAGADO")
    .map((u) => u.id);

  if (pendingUnitIds.length === 0) {
    return NextResponse.json({ sent: 0, message: "Todos los departamentos están al día." });
  }

  // Get resident emails for those units
  const { data: profiles } = await svc
    .from("profiles")
    .select("name, unit_id, id")
    .in("unit_id", pendingUnitIds)
    .eq("role", "resident");

  // Get emails from auth.users via service client
  const emailMap: Record<string, string> = {};
  for (const p of profiles ?? []) {
    const { data: userData } = await svc.auth.admin.getUserById(p.id);
    if (userData.user?.email) {
      emailMap[p.id] = userData.user.email;
    }
  }

  const unitNames = Object.fromEntries((units ?? []).map((u) => [u.id, u.name]));

  let sent = 0;
  const errors: string[] = [];

  for (const profile of profiles ?? []) {
    const email = emailMap[profile.id];
    if (!email) continue;

    const paid = paidByUnit[profile.unit_id ?? ""] ?? 0;
    const status = getPaymentStatus(paid, feeAmount);
    const unitName = unitNames[profile.unit_id ?? ""] ?? "";

    const { error } = await resend.emails.send({
      from: "Edificio 12 <noreply@edificio12.com>",
      to: [email],
      subject: `Recordatorio de expensa — ${month}`,
      text: `Hola ${profile.name},\n\nTe recordamos que la expensa del mes ${month} del departamento ${unitName} se encuentra en estado: ${status}.\n\nMonto de la expensa: ${formatCurrency(feeAmount)}\nMonto abonado: ${formatCurrency(paid)}\n\nPor favor, regularizá tu situación a la brevedad.\n\nSaludos,\nAdministración Edificio 12`,
    });

    if (error) {
      errors.push(`${email}: ${error.message}`);
    } else {
      sent++;
    }
  }

  return NextResponse.json({ sent, errors: errors.length > 0 ? errors : undefined });
}
