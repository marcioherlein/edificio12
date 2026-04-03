import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { formatCurrency, formatDate, formatMonthLabel, getPaymentStatus } from "@/lib/utils";

export async function POST(request: Request) {
  const { month } = await request.json() as { month: string };
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Mes inválido." }, { status: 400 });
  }

  const svc = createServiceClient();

  const [unitsRes, paymentsRes, expensesRes, feeRes, balanceRes, profilesRes] = await Promise.all([
    svc.from("units").select("id, name, owner_name").order("name"),
    svc.from("payments").select("id, unit_id, amount, method, date, month, notes, receipt_url").eq("month", month).order("date"),
    svc.from("expenses").select("id, description, amount, method, date, category, receipt_url").gte("date", `${month}-01`).lte("date", `${month}-31`).order("date"),
    svc.from("monthly_fees").select("amount").eq("month", month).single(),
    svc.from("account_balances").select("cash_opening, bank_opening").eq("month", month).single(),
    svc.from("profiles").select("unit_id, name").eq("role", "resident"),
  ]);

  const units = unitsRes.data ?? [];
  const payments = paymentsRes.data ?? [];
  const expenses = expensesRes.data ?? [];
  const feeAmount = Number(feeRes.data?.amount ?? 0);
  const cashOpening = Number(balanceRes.data?.cash_opening ?? 0);
  const bankOpening = Number(balanceRes.data?.bank_opening ?? 0);

  // Owner map from profiles
  const ownerByUnit: Record<string, string> = {};
  for (const p of profilesRes.data ?? []) {
    if (p.unit_id) ownerByUnit[p.unit_id] = p.name;
  }

  // Payment aggregation per unit
  const cashByUnit: Record<string, { amount: number; date: string }> = {};
  const bankByUnit: Record<string, { amount: number; date: string }> = {};
  for (const p of payments) {
    if (p.method === "efectivo") {
      cashByUnit[p.unit_id] = {
        amount: (cashByUnit[p.unit_id]?.amount ?? 0) + Number(p.amount),
        date: p.date,
      };
    } else {
      bankByUnit[p.unit_id] = {
        amount: (bankByUnit[p.unit_id]?.amount ?? 0) + Number(p.amount),
        date: p.date,
      };
    }
  }

  const totalCashIn = payments.filter((p) => p.method === "efectivo").reduce((s, p) => s + Number(p.amount), 0);
  const totalBankIn = payments.filter((p) => p.method === "transferencia").reduce((s, p) => s + Number(p.amount), 0);
  const totalIn = totalCashIn + totalBankIn;
  const totalCashOut = expenses.filter((e) => e.method === "efectivo").reduce((s, e) => s + Number(e.amount), 0);
  const totalBankOut = expenses.filter((e) => e.method !== "efectivo").reduce((s, e) => s + Number(e.amount), 0);
  const totalOut = totalCashOut + totalBankOut;
  const opening = cashOpening + bankOpening;
  const fund = opening + totalIn - totalOut;

  const monthLabel = formatMonthLabel(month);

  // Build HTML report (matches Excel structure)
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Liquidación ${monthLabel}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 0; padding: 24px; background: white; }
    h1 { font-size: 16px; text-align: center; margin: 0 0 4px; }
    .subtitle { text-align: center; font-size: 13px; color: #555; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th, td { border: 1px solid #ccc; padding: 5px 8px; }
    th { background: #e8eaf6; font-weight: bold; text-align: center; }
    td { text-align: center; }
    td.left { text-align: left; }
    .paid { background: #d4edda; }
    .partial { background: #fff3cd; }
    .pending { background: #f8d7da; }
    .section-title { font-weight: bold; font-size: 13px; margin: 16px 0 6px; border-bottom: 2px solid #333; padding-bottom: 3px; }
    .summary-table td { text-align: right; }
    .summary-table td.label { text-align: left; font-weight: bold; background: #f0f0f0; }
    .total-row { background: #1a3a6e; color: white; font-weight: bold; }
    .total-row td { border-color: #1a3a6e; }
    .print-btn { display: block; margin: 20px auto; padding: 10px 24px; background: #2563eb; color: white; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; font-weight: bold; }
    @media print { .print-btn { display: none; } body { padding: 12px; } }
    .footer { text-align: center; color: #888; font-size: 10px; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 12px; }
    .receipt-link { color: #2563eb; text-decoration: none; font-size: 11px; }
  </style>
</head>
<body>
  <h1>Consorcio Edificio 12 — Reinalda Rodriguez 4112</h1>
  <div class="subtitle">Liquidación correspondiente al mes de ${monthLabel}</div>

  <button class="print-btn" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>

  <!-- UNIT PAYMENTS TABLE -->
  <div class="section-title">Ingresos por expensas</div>
  <table>
    <thead>
      <tr>
        <th>Depto.</th>
        <th>Propietario</th>
        <th>Expensa</th>
        <th>Efectivo</th>
        <th>Transferencia</th>
        <th>Fecha</th>
        <th>Estado</th>
      </tr>
    </thead>
    <tbody>
      ${units.map((u) => {
        const cash = cashByUnit[u.id]?.amount ?? 0;
        const bank = bankByUnit[u.id]?.amount ?? 0;
        const paid = cash + bank;
        const status = getPaymentStatus(paid, feeAmount);
        const rowClass = status === "PAGADO" ? "paid" : status === "PARCIAL" ? "partial" : "pending";
        const lastDate = cashByUnit[u.id]?.date ?? bankByUnit[u.id]?.date ?? "";
        const owner = ownerByUnit[u.id] ?? u.owner_name ?? "—";
        return `<tr class="${rowClass}">
          <td>${u.name}</td>
          <td class="left">${owner}</td>
          <td>${feeAmount > 0 ? formatCurrency(feeAmount) : "—"}</td>
          <td>${cash > 0 ? formatCurrency(cash) : ""}</td>
          <td>${bank > 0 ? formatCurrency(bank) : ""}</td>
          <td>${lastDate ? formatDate(lastDate) : ""}</td>
          <td><strong>${status}</strong></td>
        </tr>`;
      }).join("")}
      <tr style="background:#e8eaf6;font-weight:bold">
        <td colspan="3">Total</td>
        <td>${formatCurrency(totalCashIn)}</td>
        <td>${formatCurrency(totalBankIn)}</td>
        <td></td>
        <td>${formatCurrency(totalIn)}</td>
      </tr>
    </tbody>
  </table>

  <!-- EXPENSES TABLE -->
  <div class="section-title">Egresos del mes</div>
  <table>
    <thead>
      <tr>
        <th>Descripción</th>
        <th>Categoría</th>
        <th>Fecha</th>
        <th>Efectivo</th>
        <th>Transferencia</th>
        <th>Comprobante</th>
      </tr>
    </thead>
    <tbody>
      ${expenses.map((e) => {
        const isCash = e.method === "efectivo";
        return `<tr>
          <td class="left">${e.description}</td>
          <td>${e.category}</td>
          <td>${formatDate(e.date)}</td>
          <td>${isCash ? formatCurrency(e.amount) : ""}</td>
          <td>${!isCash ? formatCurrency(e.amount) : ""}</td>
          <td>${e.receipt_url
            ? `<a class="receipt-link" href="${e.receipt_url}" target="_blank">Ver 📎</a>`
            : isCash
              ? `<a class="receipt-link" href="/api/expense-receipts/${e.id}" target="_blank">Comp. 🧾</a>`
              : "—"
          }</td>
        </tr>`;
      }).join("")}
      <tr style="background:#e8eaf6;font-weight:bold">
        <td colspan="3">Total egresos</td>
        <td>${formatCurrency(totalCashOut)}</td>
        <td>${formatCurrency(totalBankOut)}</td>
        <td></td>
      </tr>
    </tbody>
  </table>

  <!-- ACCOUNT BALANCES -->
  <div class="section-title">Resumen de cuentas</div>
  <table class="summary-table" style="max-width:500px">
    <tr><td class="label">Saldo anterior (Caja)</td><td>${formatCurrency(cashOpening)}</td></tr>
    <tr><td class="label">Entró en efectivo</td><td>${formatCurrency(totalCashIn)}</td></tr>
    <tr><td class="label">Gastos en efectivo</td><td>− ${formatCurrency(totalCashOut)}</td></tr>
    <tr style="background:#fffbeb"><td class="label">Total Caja</td><td><strong>${formatCurrency(cashOpening + totalCashIn - totalCashOut)}</strong></td></tr>
    <tr><td></td><td></td></tr>
    <tr><td class="label">Saldo anterior (Cta. Ualá)</td><td>${formatCurrency(bankOpening)}</td></tr>
    <tr><td class="label">Entró por transferencia</td><td>${formatCurrency(totalBankIn)}</td></tr>
    <tr><td class="label">Gastos por transferencia</td><td>− ${formatCurrency(totalBankOut)}</td></tr>
    <tr style="background:#e8f0fe"><td class="label">Total Cta. Ualá</td><td><strong>${formatCurrency(bankOpening + totalBankIn - totalBankOut)}</strong></td></tr>
    <tr><td></td><td></td></tr>
    <tr><td class="label">Saldo anterior total</td><td>${formatCurrency(opening)}</td></tr>
    <tr><td class="label">Ingresa por expensas</td><td>${formatCurrency(totalIn)}</td></tr>
    <tr><td class="label">Egresos del mes</td><td>− ${formatCurrency(totalOut)}</td></tr>
    <tr class="total-row"><td class="label" style="color:white">Fondo para mes siguiente</td><td><strong>${formatCurrency(fund)}</strong></td></tr>
  </table>

  <div class="footer">
    Reporte generado el ${new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })}
    · Edificio 12 — Sistema de gestión de expensas
  </div>
</body>
</html>`;

  const summary = {
    month,
    total_in: totalIn,
    total_out: totalOut,
    cash_opening: cashOpening,
    bank_opening: bankOpening,
    cash_balance: cashOpening + totalCashIn - totalCashOut,
    bank_balance: bankOpening + totalBankIn - totalBankOut,
    fund,
    units_paid: units.filter((u) => getPaymentStatus((cashByUnit[u.id]?.amount ?? 0) + (bankByUnit[u.id]?.amount ?? 0), feeAmount) === "PAGADO").length,
    units_total: units.length,
  };

  // Upsert report in DB
  const { error } = await svc.from("monthly_reports").upsert({
    month,
    report_html: html,
    summary,
    generated_at: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: "Error al guardar: " + error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, summary });
}
