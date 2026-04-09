import { createServiceClient } from "@/lib/supabase/server";
import { formatCurrency, formatMonthLabel } from "@/lib/utils";
import Link from "next/link";

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

export default async function CategoryHistoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const categoryName = decodeURIComponent(category);
  const svc = createServiceClient();

  const { data: expenses } = await svc
    .from("expenses")
    .select("id, amount, method, date, receipt_url, notes")
    .eq("category", categoryName)
    .order("date", { ascending: false });

  const rows = expenses ?? [];

  // Group by month
  const byMonth: Record<string, typeof rows> = {};
  for (const e of rows) {
    const month = e.date.slice(0, 7);
    if (!byMonth[month]) byMonth[month] = [];
    byMonth[month].push(e);
  }
  const sortedMonths = Object.keys(byMonth).sort().reverse();

  const total = rows.reduce((a, e) => a + Number(e.amount), 0);

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
              {categoryName}
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--fiori-text-muted)" }}>Historial de egresos por categoría</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-widest" style={{ color: "var(--fiori-text-muted)" }}>Total gastado</p>
            <p className="text-xl font-bold mt-0.5" style={{ color: "var(--fiori-error)" }}>{formatCurrency(total)}</p>
            <p className="text-xs" style={{ color: "var(--fiori-text-muted)" }}>{rows.length} gasto{rows.length !== 1 ? "s" : ""}</p>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="rounded border px-6 py-10 text-center bg-white" style={{ borderColor: "var(--fiori-border)" }}>
            <p style={{ color: "var(--fiori-text-muted)" }}>Sin egresos registrados para esta categoría.</p>
          </div>
        ) : (
          sortedMonths.map(month => {
            const mExpenses = byMonth[month];
            const monthTotal = mExpenses.reduce((a, e) => a + Number(e.amount), 0);
            return (
              <div key={month} className="rounded overflow-hidden border" style={{ borderColor: "var(--fiori-border)" }}>
                {/* Month header */}
                <div className="px-5 py-3 flex items-center justify-between border-b"
                  style={{ background: "var(--fiori-table-header)", borderColor: "var(--fiori-border)" }}>
                  <span className="text-sm font-bold uppercase tracking-widest" style={{ color: "var(--fiori-text-muted)" }}>
                    {formatMonthLabel(month)}
                  </span>
                  <span className="text-sm font-bold" style={{ color: "var(--fiori-error)" }}>{formatCurrency(monthTotal)}</span>
                </div>

                {/* Expense rows */}
                <div className="divide-y bg-white" style={{ borderColor: "var(--fiori-border)" }}>
                  {mExpenses.map(e => (
                    <div key={e.id} className="flex items-center justify-between px-5 py-4"
                      style={{ borderColor: "var(--fiori-border)" }}>
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-2xl shrink-0">{e.method === "efectivo" ? "💵" : "🏦"}</span>
                        <div className="min-w-0">
                          <p className="text-base font-bold" style={{ color: "var(--fiori-text)" }}>
                            {formatCurrency(Number(e.amount))}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-sm" style={{ color: "var(--fiori-text-muted)" }}>{formatDate(e.date)}</span>
                            <span className={`text-xs px-2 py-0.5 rounded border font-medium ${
                              e.method === "efectivo"
                                ? "bg-[#f1fdf6] text-[#107e3e] border-[#107e3e]/30"
                                : "bg-[#e8f2ff] text-[#0070f2] border-[#0070f2]/30"
                            }`}>
                              {e.method === "efectivo" ? "Efectivo" : "Transferencia"}
                            </span>
                            {e.notes && (
                              <span className="text-xs italic" style={{ color: "var(--fiori-text-muted)" }}>{e.notes}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      {e.receipt_url && (
                        <a href={e.receipt_url} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded border ml-3 shrink-0 transition-colors"
                          style={{ color: "var(--fiori-blue)", borderColor: "var(--fiori-blue)", background: "#e8f2ff" }}>
                          📎 Adjunto
                        </a>
                      )}
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
