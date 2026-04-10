import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { formatCurrency, formatDate, formatMonthLabel } from "@/lib/utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const svc = createServiceClient();

  const { data: payment, error } = await svc
    .from("payments")
    .select("*, units(name, owner_name)")
    .eq("id", id)
    .single();

  if (error || !payment) {
    return new NextResponse("Comprobante no encontrado.", { status: 404 });
  }

  const unitName    = (payment as any).units?.name ?? "—";
  const ownerName   = (payment as any).units?.owner_name ?? "—";
  const payerName   = (payment as any).payer_name || ownerName;
  const methodLabel = payment.method === "efectivo" ? "Efectivo" : "Transferencia bancaria";
  const periodLabel = formatMonthLabel(payment.month);
  const receiptId   = payment.id as string;
  const shortId     = receiptId.slice(0, 8).toUpperCase();

  const [py, pm, pd] = (payment.date as string).split("-").map(Number);
  const paymentDate = new Date(py, pm - 1, pd);
  const fullDateLabel = paymentDate.toLocaleDateString("es-AR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Comprobante #${shortId}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background: #f8fafc;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 40px 16px;
      min-height: 100vh;
    }
    .page { width: 100%; max-width: 480px; }

    /* Print button */
    .print-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 10px 20px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
      justify-content: center;
    }
    .print-btn:hover { background: #2563eb; }

    /* Receipt card */
    .receipt {
      background: white;
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    }

    /* Header */
    .header {
      background: linear-gradient(135deg, #334155 0%, #1e293b 100%);
      color: white;
      padding: 28px 28px 24px;
    }
    .header-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }
    .building-name {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.3px;
    }
    .receipt-badge {
      background: rgba(255,255,255,0.15);
      border: 1px solid rgba(255,255,255,0.25);
      border-radius: 6px;
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .receipt-subtitle {
      font-size: 13px;
      color: rgba(255,255,255,0.65);
      margin-bottom: 20px;
    }

    /* Amount block */
    .amount-block {
      background: rgba(255,255,255,0.10);
      border: 1px solid rgba(255,255,255,0.20);
      border-radius: 10px;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .amount-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: rgba(255,255,255,0.65);
      margin-bottom: 4px;
    }
    .amount-value {
      font-size: 30px;
      font-weight: 800;
      color: white;
      letter-spacing: -1px;
    }
    .paid-badge {
      background: #16a34a;
      color: white;
      border-radius: 8px;
      padding: 6px 14px;
      font-size: 13px;
      font-weight: 700;
      white-space: nowrap;
    }

    /* Body */
    .body { padding: 0 28px; }
    .section-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #94a3b8;
      padding: 18px 0 8px;
      border-bottom: 1px solid #f1f5f9;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 11px 0;
      border-bottom: 1px solid #f8fafc;
    }
    .row:last-child { border-bottom: none; }
    .row-key {
      font-size: 13px;
      color: #64748b;
      min-width: 130px;
    }
    .row-val {
      font-size: 13px;
      font-weight: 600;
      color: #0f172a;
      text-align: right;
      flex: 1;
    }
    .row-val.muted { color: #94a3b8; font-size: 11px; word-break: break-all; }

    /* Signature */
    .signature {
      margin: 20px 28px 0;
      padding: 20px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      text-align: center;
    }
    .sig-line {
      width: 200px;
      height: 1px;
      background: #334155;
      margin: 0 auto 10px;
    }
    .sig-name {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
    }
    .sig-role {
      font-size: 11px;
      color: #64748b;
      margin-top: 2px;
    }

    /* Footer */
    .footer {
      padding: 16px 28px 24px;
      text-align: center;
    }
    .footer p {
      font-size: 11px;
      color: #94a3b8;
      line-height: 1.6;
    }
    .footer-id {
      display: inline-block;
      margin-top: 8px;
      font-family: monospace;
      font-size: 10px;
      color: #cbd5e1;
      letter-spacing: 0.5px;
    }

    @media print {
      body { background: white; padding: 0; }
      .print-btn { display: none; }
      .receipt { box-shadow: none; border-radius: 0; border: none; max-width: 100%; }
      .page { max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="page">
    <button class="print-btn" onclick="window.print()">
      🖨️ Imprimir / Guardar como PDF
    </button>

    <div class="receipt">
      <!-- Header -->
      <div class="header">
        <div class="header-top">
          <div>
            <div class="building-name">Edificio 12</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.60);margin-top:3px;">
              Reinalda Rodríguez 4112, Ciudad Evita, Buenos Aires
            </div>
          </div>
          <div class="receipt-badge">✓ Pagado</div>
        </div>
        <div class="receipt-subtitle">Comprobante de recibo de pago de expensas</div>
        <div class="amount-block">
          <div>
            <div class="amount-label">Monto abonado</div>
            <div class="amount-value">${formatCurrency(payment.amount)}</div>
          </div>
          <div class="paid-badge">RECIBIDO</div>
        </div>
      </div>

      <!-- Body -->
      <div class="body">
        <div class="section-title">Detalle del pago</div>

        <div class="row">
          <span class="row-key">Recibí de</span>
          <span class="row-val">${payerName}</span>
        </div>
        <div class="row">
          <span class="row-key">Departamento</span>
          <span class="row-val">${unitName}</span>
        </div>
        <div class="row">
          <span class="row-key">Período</span>
          <span class="row-val">${periodLabel}</span>
        </div>
        <div class="row">
          <span class="row-key">Fecha de pago</span>
          <span class="row-val" style="text-transform:capitalize">${fullDateLabel}</span>
        </div>
        <div class="row">
          <span class="row-key">Forma de pago</span>
          <span class="row-val">${methodLabel}</span>
        </div>
        ${(payment as any).notes ? `
        <div class="row">
          <span class="row-key">Observaciones</span>
          <span class="row-val">${(payment as any).notes}</span>
        </div>` : ""}
        <div class="row">
          <span class="row-key">N° comprobante</span>
          <span class="row-val muted">${receiptId}</span>
        </div>
      </div>

      <!-- Signature -->
      <div class="signature">
        <div class="sig-line"></div>
        <div class="sig-name">Fabiana Herlein</div>
        <div class="sig-role">Administradora — Edificio 12</div>
      </div>

      <!-- Footer -->
      <div class="footer">
        <p>Este comprobante acredita la recepción del pago indicado.<br>
        Es válido como constancia de pago de expensas.</p>
        <span class="footer-id">#${receiptId}</span>
      </div>
    </div>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const payer_name = typeof body?.payer_name === "string"
    ? body.payer_name.trim().slice(0, 200) || null
    : null;

  const svc = createServiceClient();

  const { error } = await svc
    .from("payments")
    .update({ payer_name })
    .eq("id", id);

  if (error) {
    console.error("[receipts PATCH]", error);
    return NextResponse.json({ error: "Error al actualizar el comprobante." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
