import { NextResponse } from "next/server";

// Vercel Cron: runs at 09:00 UTC on the 10th of every month.
// Generates the final report for the PREVIOUS month and publishes it to Documents.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  // Compute previous month
  const now    = new Date();
  const year   = now.getFullYear();
  const mo     = now.getMonth(); // 0-indexed, so this IS the previous calendar month
  const prevM  = mo === 0 ? 12 : mo;
  const prevY  = mo === 0 ? year - 1 : year;
  const month  = `${prevY}-${String(prevM).padStart(2, "0")}`;

  // Call the finalize route internally using absolute URL
  const host    = request.headers.get("host") ?? "localhost:3000";
  const proto   = host.startsWith("localhost") ? "http" : "https";
  const baseUrl = `${proto}://${host}`;

  const res = await fetch(`${baseUrl}/api/reports/finalize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {}),
    },
    body: JSON.stringify({ month }),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error("[cron] Failed to finalize report for", month, body);
    return NextResponse.json({ error: "Error al finalizar reporte", month, detail: body }, { status: 500 });
  }

  console.log("[cron] Report finalized for", month);
  return NextResponse.json({ ok: true, month, summary: body.summary });
}
