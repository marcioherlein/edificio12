import { createServiceClient, createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { formatCurrency, formatDate, formatMonthLabel } from "@/lib/utils";

// Called by the "♻️ Regenerar" button in the report viewer (admin session),
// OR internally via Authorization: Bearer CRON_SECRET (e.g. after data corrections).
export async function POST(request: Request) {
  // ── Auth: admin session OR cron secret ──────────────────────────────────
  const authHeader  = request.headers.get("authorization");
  const cronSecret  = process.env.CRON_SECRET;
  const isCronCall  = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isCronCall) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") return NextResponse.json({ error: "Solo el administrador." }, { status: 403 });
  }
  // ────────────────────────────────────────────────────────────────────────

  const { month } = await request.json() as { month: string };
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Mes inválido." }, { status: 400 });
  }

  const svc = createServiceClient();

  const [y, m] = month.split("-").map(Number);
  const nextMonthStr = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;

  const [unitsRes, paymentsRes, expensesRes, feeRes, balanceRes, unitBalancesRes] = await Promise.all([
    svc.from("units").select("id, name, owner_name").order("name"),
    svc.from("payments")
      .select("id, unit_id, amount, method, date, month, notes, receipt_url")
      .gte("date", `${month}-01`)
      .lt("date", nextMonthStr)
      .order("date"),
    svc.from("expenses")
      .select("id, description, amount, method, date, category, receipt_url")
      .gte("date", `${month}-01`)
      .lt("date", nextMonthStr)
      .order("date"),
    svc.from("monthly_fees").select("amount").eq("month", month).single(),
    svc.from("account_balances").select("cash_opening, bank_opening, bank_interest").eq("month", month).single(),
    svc.from("unit_balances").select("unit_id, opening_balance").eq("month", month),
  ]);

  const units        = unitsRes.data ?? [];
  const payments     = paymentsRes.data ?? [];
  const expenses     = expensesRes.data ?? [];
  const feeAmount    = Number(feeRes.data?.amount ?? 0);
  const cashOpening  = Number(balanceRes.data?.cash_opening ?? 0);
  const bankOpening  = Number(balanceRes.data?.bank_opening ?? 0);
  const bankInterest = Number((balanceRes.data as any)?.bank_interest ?? 0);

  const openingByUnit: Record<string, number> = {};
  for (const b of unitBalancesRes.data ?? []) {
    openingByUnit[b.unit_id] = Number(b.opening_balance);
  }

  const cashByUnit: Record<string, number> = {};
  const bankByUnit: Record<string, number> = {};
  const dateByUnit: Record<string, string> = {};
  for (const p of payments) {
    if (p.method === "efectivo") {
      cashByUnit[p.unit_id] = (cashByUnit[p.unit_id] ?? 0) + Number(p.amount);
    } else {
      bankByUnit[p.unit_id] = (bankByUnit[p.unit_id] ?? 0) + Number(p.amount);
    }
    dateByUnit[p.unit_id] = p.date;
  }

  const totalCashIn  = payments.filter(p => p.method === "efectivo").reduce((s, p) => s + Number(p.amount), 0);
  const totalBankIn  = payments.filter(p => p.method === "transferencia").reduce((s, p) => s + Number(p.amount), 0);
  const totalIn      = totalCashIn + totalBankIn;
  const totalCashOut = expenses.filter(e => e.method === "efectivo").reduce((s, e) => s + Number(e.amount), 0);
  const totalBankOut = expenses.filter(e => e.method !== "efectivo").reduce((s, e) => s + Number(e.amount), 0);
  const totalOut     = totalCashOut + totalBankOut;
  const opening      = cashOpening + bankOpening;
  const fund         = opening + totalIn + bankInterest - totalOut;

  const monthLabel      = formatMonthLabel(month);
  const monthLabelUp    = monthLabel.toUpperCase();
  const generatedAt     = new Date();
  const generatedLabel  = generatedAt.toLocaleDateString("es-AR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });
  const generatedTime   = generatedAt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  const lastDay         = new Date(y, m, 0).getDate();
  const closingDateLabel = `${String(lastDay).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>REPORTE FINAL — ${monthLabelUp}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #111; background: #fff; padding: 32px; }
    .header { border-bottom: 3px solid #1a3a6e; padding-bottom: 14px; margin-bottom: 18px; }
    .header-top { display: flex; align-items: flex-start; justify-content: space-between; }
    .header-logo { font-size: 22px; font-weight: 900; color: #1a3a6e; letter-spacing: 1px; }
    .header-sub { font-size: 13px; color: #555; margin-top: 2px; }
    .header-badge { background: #1a3a6e; color: #fff; font-size: 10px; font-weight: bold; letter-spacing: 1.5px; padding: 4px 10px; border-radius: 4px; text-transform: uppercase; }
    .report-title { margin-top: 10px; }
    .report-title h1 { font-size: 20px; font-weight: 900; color: #1a3a6e; text-transform: uppercase; }
    .report-title p { font-size: 13px; color: #444; margin-top: 2px; }
    .meta-bar { display: flex; gap: 24px; background: #f0f4ff; border: 1px solid #c5d0e8; border-radius: 6px; padding: 10px 16px; margin-bottom: 20px; font-size: 11px; color: #333; }
    .meta-bar span { color: #555; }
    .meta-bar strong { color: #1a3a6e; }
    .section-title { font-size: 12px; font-weight: bold; letter-spacing: 0.5px; text-transform: uppercase; color: #1a3a6e; border-bottom: 2px solid #1a3a6e; padding-bottom: 4px; margin: 22px 0 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { background: #1a3a6e; color: #fff; font-size: 11px; font-weight: bold; text-align: center; padding: 7px 6px; letter-spacing: 0.3px; }
    td { border: 1px solid #d0d7e8; padding: 5px 7px; font-size: 11px; text-align: center; }
    td.left { text-align: left; }
    tr:nth-child(even) td { background: #f7f9fd; }
    .paid td { background: #dcf5e7 !important; }
    .partial td { background: #fef9e0 !important; }
    .pending td { background: #fde8e8 !important; }
    .total-row td { background: #1a3a6e !important; color: #fff; font-weight: bold; border-color: #1a3a6e; }
    .subtotal-row td { background: #e8eaf6 !important; font-weight: bold; }
    .summary-wrap { max-width: 520px; }
    .summary-wrap table td { text-align: right; }
    .summary-wrap .lbl { text-align: left; font-weight: bold; background: #f0f4ff !important; color: #1a3a6e; }
    .summary-wrap .total-row td.lbl { background: #1a3a6e !important; color: #fff; }
    .signature-section { margin-top: 36px; border-top: 1px solid #ccc; padding-top: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
    .sig-block { text-align: center; }
    .sig-line { border-top: 1.5px solid #333; width: 220px; margin: 0 auto 6px; }
    .sig-name { font-weight: bold; font-size: 12px; }
    .sig-role { font-size: 11px; color: #555; margin-top: 2px; }
    .footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #888; text-align: center; line-height: 1.6; }
    .no-print { display: block; margin: 0 auto 24px; padding: 10px 28px; background: #2563eb; color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: bold; cursor: pointer; }
    @media print { .no-print { display: none; } body { padding: 18px; } @page { margin: 18mm; } }
  </style>
</head>
<body>
  <button class="no-print" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>
  <div class="header">
    <div class="header-top">
      <div>
        <div class="header-logo">EDIFICIO 12</div>
        <div class="header-sub">Reinalda Rodriguez 4112 · Consorcio de Propietarios</div>
      </div>
      <div class="header-badge">Documento Oficial</div>
    </div>
    <div class="report-title">
      <h1>Reporte Final — ${monthLabelUp}</h1>
      <p>Liquidación mensual de expensas y balance de cuentas</p>
    </div>
  </div>
  <div class="meta-bar">
    <div><span>Período: </span><strong>${monthLabel}</strong></div>
    <div><span>Fecha de emisión: </span><strong>${generatedLabel}</strong></div>
    <div><span>Hora: </span><strong>${generatedTime} hs</strong></div>
    <div><span>Administrador: </span><strong>Fabiana Herlein</strong></div>
  </div>
  <div class="section-title">Ingresos por expensas</div>
  <table>
    <thead>
      <tr>
        <th>Depto.</th>
        <th>Usuario</th>
        <th>Anterior</th>
        <th>Expensa</th>
        <th>Efectivo</th>
        <th>Transferencia</th>
        <th>Fecha pago</th>
        <th>${closingDateLabel}</th>
      </tr>
    </thead>
    <tbody>
      ${units.map((u) => {
        const cash     = cashByUnit[u.id] ?? 0;
        const bank     = bankByUnit[u.id] ?? 0;
        const anterior = openingByUnit[u.id] ?? 0;
        const saldo    = anterior + feeAmount - cash - bank;
        const isPaid   = saldo <= 0;
        const hasPaid  = (cash + bank) > 0;
        const rowClass = isPaid ? "paid" : hasPaid ? "partial" : "pending";
        const lastDate = dateByUnit[u.id] ?? "";
        return `<tr class="${rowClass}">
          <td><strong>${u.name}</strong></td>
          <td class="left">${u.owner_name ?? "—"}</td>
          <td>${anterior > 0 ? formatCurrency(anterior) : "—"}</td>
          <td>${feeAmount > 0 ? formatCurrency(feeAmount) : "—"}</td>
          <td>${cash > 0 ? formatCurrency(cash) : "—"}</td>
          <td>${bank > 0 ? formatCurrency(bank) : "—"}</td>
          <td>${lastDate ? formatDate(lastDate) : "—"}</td>
          <td><strong>${saldo > 0 ? formatCurrency(saldo) : "✓"}</strong></td>
        </tr>`;
      }).join("")}
      <tr class="subtotal-row">
        <td colspan="4">Total ingresos del mes</td>
        <td>${formatCurrency(totalCashIn)}</td>
        <td>${formatCurrency(totalBankIn)}</td>
        <td></td>
        <td><strong>${formatCurrency(totalIn)}</strong></td>
      </tr>
    </tbody>
  </table>
  <div class="section-title">Egresos del mes</div>
  ${expenses.length === 0
    ? `<p style="color:#888;font-size:12px;margin-bottom:16px;font-style:italic">Sin egresos registrados para este mes.</p>`
    : `<table>
    <thead>
      <tr>
        <th>Descripción</th><th>Categoría</th><th>Fecha</th><th>Efectivo</th><th>Transferencia</th><th>Comprobante</th>
      </tr>
    </thead>
    <tbody>
      ${expenses.map((e) => {
        const isCash = e.method === "efectivo";
        return `<tr>
          <td class="left">${e.description}</td>
          <td>${e.category ?? "—"}</td>
          <td>${formatDate(e.date)}</td>
          <td>${isCash ? formatCurrency(e.amount) : "—"}</td>
          <td>${!isCash ? formatCurrency(e.amount) : "—"}</td>
          <td>${e.receipt_url
            ? `<a href="${e.receipt_url}" target="_blank" style="color:#2563eb;font-size:10px">Ver 📎</a>`
            : isCash
              ? `<a href="/api/expense-receipts/${e.id}" target="_blank" style="color:#2563eb;font-size:10px">Comp. 🧾</a>`
              : "—"
          }</td>
        </tr>`;
      }).join("")}
      <tr class="subtotal-row">
        <td colspan="3">Total egresos</td>
        <td>${formatCurrency(totalCashOut)}</td>
        <td>${formatCurrency(totalBankOut)}</td>
        <td></td>
      </tr>
    </tbody>
  </table>`}
  <div class="section-title">Balance de cuentas</div>
  <div class="summary-wrap">
    <table>
      <tr><td class="lbl">Saldo apertura — Caja (efectivo)</td><td>${formatCurrency(cashOpening)}</td></tr>
      <tr><td class="lbl">+ Entró en efectivo</td><td>${formatCurrency(totalCashIn)}</td></tr>
      <tr><td class="lbl">− Gastos en efectivo</td><td>− ${formatCurrency(totalCashOut)}</td></tr>
      <tr class="subtotal-row"><td class="lbl">= Saldo Caja</td><td><strong>${formatCurrency(cashOpening + totalCashIn - totalCashOut)}</strong></td></tr>
      <tr><td colspan="2" style="border:none;padding:4px"></td></tr>
      <tr><td class="lbl">Saldo apertura — Cta. Ualá</td><td>${formatCurrency(bankOpening)}</td></tr>
      <tr><td class="lbl">+ Entró por transferencia</td><td>${formatCurrency(totalBankIn)}</td></tr>
      ${bankInterest > 0 ? `<tr><td class="lbl">+ Intereses Ualá</td><td>${formatCurrency(bankInterest)}</td></tr>` : ""}
      <tr><td class="lbl">− Gastos por transferencia</td><td>− ${formatCurrency(totalBankOut)}</td></tr>
      <tr class="subtotal-row"><td class="lbl">= Saldo Cta. Ualá</td><td><strong>${formatCurrency(bankOpening + totalBankIn + bankInterest - totalBankOut)}</strong></td></tr>
      <tr><td colspan="2" style="border:none;padding:6px"></td></tr>
      <tr><td class="lbl">Saldo total de apertura</td><td>${formatCurrency(opening)}</td></tr>
      <tr><td class="lbl">+ Total ingresos</td><td>${formatCurrency(totalIn)}</td></tr>
      ${bankInterest > 0 ? `<tr><td class="lbl">+ Intereses Ualá</td><td>${formatCurrency(bankInterest)}</td></tr>` : ""}
      <tr><td class="lbl">− Total egresos</td><td>− ${formatCurrency(totalOut)}</td></tr>
      <tr class="total-row"><td class="lbl">= FONDO PARA MES SIGUIENTE</td><td><strong>${formatCurrency(fund)}</strong></td></tr>
    </table>
  </div>
  <div class="signature-section">
    <div style="font-size:11px;color:#555;max-width:320px">
      <p>Este reporte fue generado automáticamente el <strong>${generatedLabel}</strong> a las <strong>${generatedTime} hs</strong>.</p>
      <p style="margin-top:6px">Corresponde al período <strong>${monthLabel}</strong> y refleja todos los movimientos registrados en el sistema.</p>
    </div>
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-name">Fabiana Herlein</div>
      <div class="sig-role">Administradora</div>
      <div class="sig-role">Edificio 12 — Consorcio de Propietarios</div>
    </div>
  </div>
  <div class="footer">
    REPORTE FINAL ${monthLabelUp} · Edificio 12 · Generado el ${generatedLabel} ${generatedTime} hs · Sistema de gestión de expensas
  </div>
</body>
</html>`;

  const summary = {
    month, total_in: totalIn, total_out: totalOut,
    cash_opening: cashOpening, bank_opening: bankOpening,
    cash_balance: cashOpening + totalCashIn - totalCashOut,
    bank_balance: bankOpening + totalBankIn + bankInterest - totalBankOut,
    fund,
    units_paid: units.filter(u => {
      const anterior = openingByUnit[u.id] ?? 0;
      const saldo = anterior + feeAmount - (cashByUnit[u.id] ?? 0) - (bankByUnit[u.id] ?? 0);
      return saldo <= 0;
    }).length,
    units_total: units.length,
  };

  await svc.from("monthly_reports").delete().eq("month", month);
  await svc.from("monthly_reports").insert({
    month, report_html: html, summary, generated_at: generatedAt.toISOString(),
  });

  // Always upsert documents entry so Docs tab reflects the latest report
  const docTitle = `REPORTE FINAL MES ${monthLabelUp}`;
  const fileUrl  = `/api/reports/view/${month}`;

  const { data: existing } = await svc
    .from("documents")
    .select("id")
    .eq("file_url", fileUrl)
    .maybeSingle();

  if (!existing) {
    await svc.from("documents").insert({
      title: docTitle, file_url: fileUrl, type: "Reporte",
      created_at: generatedAt.toISOString(),
    });
  } else {
    await svc.from("documents").update({
      title: docTitle, created_at: generatedAt.toISOString(),
    }).eq("id", existing.id);
  }

  return NextResponse.json({ ok: true, month, summary });
}
