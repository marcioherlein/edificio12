import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { formatCurrency, formatDate } from "@/lib/utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const svc = createServiceClient();

  const { data: expense, error } = await svc
    .from("expenses")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !expense) {
    return new NextResponse("Comprobante no encontrado.", { status: 404 });
  }

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Comprobante de Egreso</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; display: flex; justify-content: center; padding: 40px 16px; min-height: 100vh; }
    .receipt { background: white; border-radius: 16px; width: 100%; max-width: 440px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #d97706, #b45309); color: white; padding: 28px 24px; text-align: center; }
    .header h1 { font-size: 22px; font-weight: 700; }
    .header p { font-size: 13px; opacity: 0.85; margin-top: 4px; }
    .badge { display: inline-block; background: rgba(255,255,255,0.2); border-radius: 20px; padding: 3px 12px; font-size: 11px; font-weight: 600; margin-top: 10px; }
    .body { padding: 24px; }
    .amount-box { background: #fffbeb; border: 2px solid #fde68a; border-radius: 12px; padding: 16px; text-align: center; margin-bottom: 20px; }
    .amount-box .label { font-size: 12px; color: #92400e; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .amount-box .amount { font-size: 32px; font-weight: 800; color: #78350f; margin-top: 4px; }
    .row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f3f4f6; }
    .row:last-child { border-bottom: none; }
    .row .key { font-size: 13px; color: #6b7280; }
    .row .val { font-size: 13px; font-weight: 600; color: #111827; text-align: right; max-width: 60%; }
    .footer { background: #f9fafb; padding: 16px 24px; text-align: center; }
    .footer p { font-size: 11px; color: #9ca3af; line-height: 1.5; }
    @media print { body { background: white; padding: 0; } .receipt { box-shadow: none; max-width: 100%; border-radius: 0; } }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <h1>Edificio 12</h1>
      <p>Comprobante de Egreso en Efectivo</p>
      <span class="badge">EGRESO REGISTRADO</span>
    </div>
    <div class="body">
      <div class="amount-box">
        <div class="label">Monto pagado</div>
        <div class="amount">${formatCurrency(expense.amount)}</div>
      </div>
      <div class="row">
        <span class="key">Descripción</span>
        <span class="val">${expense.description}</span>
      </div>
      <div class="row">
        <span class="key">Categoría</span>
        <span class="val">${expense.category}</span>
      </div>
      <div class="row">
        <span class="key">Fecha</span>
        <span class="val">${formatDate(expense.date)}</span>
      </div>
      <div class="row">
        <span class="key">Forma de pago</span>
        <span class="val">Efectivo</span>
      </div>
      <div class="row">
        <span class="key">N° de registro</span>
        <span class="val" style="font-size:10px;color:#9ca3af">${expense.id}</span>
      </div>
    </div>
    <div class="footer">
      <p>Este documento acredita el pago en efectivo realizado por la administración<br>del Consorcio Edificio 12 — Reinalda Rodriguez 4112.</p>
    </div>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
