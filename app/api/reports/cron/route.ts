import { NextResponse } from "next/server";

// Vercel Cron: runs at 09:00 UTC on the 10th of every month.
// 1. Generates the final report for the PREVIOUS month and publishes it to Documents.
// 2. Computes and saves the CURRENT month's opening balance from the previous month's closing.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  // Compute previous month (mo is 0-indexed, so getMonth() gives previous calendar month)
  const now    = new Date();
  const year   = now.getFullYear();
  const mo     = now.getMonth();
  const prevM  = mo === 0 ? 12 : mo;
  const prevY  = mo === 0 ? year - 1 : year;
  const sourceMonth = `${prevY}-${String(prevM).padStart(2, "0")}`;

  const host    = request.headers.get("host") ?? "localhost:3000";
  const proto   = host.startsWith("localhost") ? "http" : "https";
  const baseUrl = `${proto}://${host}`;
  const authHeaders = {
    "Content-Type": "application/json",
    ...(cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {}),
  };

  // ── Step 1: Finalize report for previous month ───────────────────────────────
  const reportRes = await fetch(`${baseUrl}/api/reports/finalize`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ month: sourceMonth }),
  });

  const reportBody = await reportRes.json().catch(() => ({}));

  if (!reportRes.ok) {
    console.error("[cron] Failed to finalize report for", sourceMonth, reportBody);
    return NextResponse.json(
      { error: "Error al finalizar reporte", month: sourceMonth, detail: reportBody },
      { status: 500 }
    );
  }

  console.log("[cron] Report finalized for", sourceMonth);

  // ── Step 2: Compute current month's opening from previous month's closing ────
  const closeRes = await fetch(`${baseUrl}/api/months/close`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ sourceMonth }),
  });

  const closeBody = await closeRes.json().catch(() => ({}));

  if (!closeRes.ok) {
    console.error("[cron] Failed to compute opening for", closeBody.targetMonth, closeBody);
    return NextResponse.json(
      { error: "Error al calcular apertura", detail: closeBody },
      { status: 500 }
    );
  }

  console.log("[cron] Opening computed for", closeBody.targetMonth);

  return NextResponse.json({
    ok: true,
    sourceMonth,
    targetMonth: closeBody.targetMonth,
    reportSummary: reportBody.summary,
    computed: closeBody.computed,
  });
}
