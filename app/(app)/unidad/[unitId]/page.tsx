import { createServiceClient } from "@/lib/supabase/server";
import { formatCurrency, formatMonthLabel } from "@/lib/utils";
import Link from "next/link";
import GenerateReceiptButton from "@/components/admin/GenerateReceiptButton";

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

export default async function UnitHistoryPage({
  params,
}: {
  params: Promise<{ unitId: string }>;
}) {
  const { unitId } = await params;
  const svc = createServiceClient();

  const [unitRes, paymentsRes] = await Promise.all([
    svc.from("units").select("name, owner_name").eq("id", unitId).single(),
    svc.from("payments")
      .select("id, amount, method, month, date, notes, receipt_url, payer_name")
      .eq("unit_id", unitId)
      .order("date", { ascending: false }),
  ]);

  const unit = unitRes.data;
  const payments = paymentsRes.data ?? [];

  // Group by month
  const byMonth: Record<string, typeof payments> = {};
  for (const p of payments) {
    if (!byMonth[p.month]) byMonth[p.month] = [];
    byMonth[p.month].push(p);
  }
  const sortedMonths = Object.keys(byMonth).sort().reverse();

  const totalPaid = payments.reduce((a, p) => a + Number(p.amount), 0);

  return (
    <div className="min-h-screen pb-24" style={{ background: "var(--fiori-page-bg)" }}>
      <div className="max-w-2xl mx-auto px-4 pt-6 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <Link href="/resumen" className="text-sm transition-colors" style={{ color: "var(--fiori-blue)" }}>
              ← Volver al resumen
            </Link>
            <h1 className="text-2xl font-bold mt-2" style={{ color: "var(--fiori-text)" }}>
              Unidad {unit?.name ?? "—"}
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--fiori-text-muted)" }}>{unit?.owner_name}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-widest" style={{ color: "var(--fiori-text-muted)" }}>Total pagado</p>
            <p className="text-xl font-bold mt-0.5" style={{ color: "var(--fiori-success)" }}>{formatCurrency(totalPaid)}</p>
            <p className="text-xs" style={{ color: "var(--fiori-text-muted)" }}>{payments.length} pago{payments.length !== 1 ? "s" : ""}</p>
          </div>
        </div>

        {/* Payment list grouped by month */}
        {payments.length === 0 ? (
          <div className="rounded border px-6 py-10 text-center bg-white" style={{ borderColor: "var(--fiori-border)" }}>
            <p style={{ color: "var(--fiori-text-muted)" }}>Sin pagos registrados.</p>
          </div>
        ) : (
          sortedMonths.map(month => {
            const mPayments = byMonth[month];
            const monthTotal = mPayments.reduce((a, p) => a + Number(p.amount), 0);
            return (
              <div key={month} className="rounded overflow-hidden border" style={{ borderColor: "var(--fiori-border)" }}>
                {/* Month header */}
                <div className="px-5 py-3 flex items-center justify-between border-b"
                  style={{ background: "var(--fiori-table-header)", borderColor: "var(--fiori-border)" }}>
                  <span className="text-sm font-bold uppercase tracking-widest" style={{ color: "var(--fiori-text-muted)" }}>
                    {formatMonthLabel(month)}
                  </span>
                  <span className="text-sm font-bold" style={{ color: "var(--fiori-text)" }}>{formatCurrency(monthTotal)}</span>
                </div>

                {/* Payment rows */}
                <div className="divide-y bg-white" style={{ borderColor: "var(--fiori-border)" }}>
                  {mPayments.map(p => (
                    <div key={p.id} className="flex items-center justify-between px-5 py-4"
                      style={{ borderColor: "var(--fiori-border)" }}>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{p.method === "efectivo" ? "💵" : "🏦"}</span>
                        <div>
                          <p className="text-base font-bold" style={{ color: "var(--fiori-text)" }}>
                            {formatCurrency(Number(p.amount))}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-sm" style={{ color: "var(--fiori-text-muted)" }}>{formatDate(p.date)}</span>
                            <span className={`text-xs px-2 py-0.5 rounded border font-medium ${
                              p.method === "efectivo"
                                ? "bg-[#f0fdf4] text-[#16a34a] border-[#16a34a]/30"
                                : "bg-[#eff6ff] text-[#3b82f6] border-[#3b82f6]/30"
                            }`}>
                              {p.method === "efectivo" ? "Efectivo" : "Transferencia"}
                            </span>
                            {p.notes && (
                              <span className="text-xs italic" style={{ color: "var(--fiori-text-muted)" }}>{p.notes}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Attachment links */}
                      <div className="flex items-center gap-2 ml-3 shrink-0">
                        <GenerateReceiptButton
                          paymentId={p.id}
                          defaultName={unit?.owner_name ?? ""}
                          existingPayerName={(p as any).payer_name}
                        />
                        {p.receipt_url && (
                          <a
                            href={p.receipt_url}
                            target="_blank"
                            rel="noreferrer"
                            title="Ver adjunto"
                            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded border transition-colors"
                            style={{ color: "var(--fiori-blue)", borderColor: "var(--fiori-blue)", background: "#eff6ff" }}
                          >
                            📎 Adjunto
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
