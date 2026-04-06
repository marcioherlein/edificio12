import { createServiceClient } from "@/lib/supabase/server";
import { formatCurrency, formatMonthLabel } from "@/lib/utils";
import Link from "next/link";

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
      .select("id, amount, method, month, date, notes")
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
    <div className="min-h-screen bg-gray-950 pb-24">
      <div className="max-w-2xl mx-auto px-4 pt-6 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <Link href="/resumen" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
              ← Volver al resumen
            </Link>
            <h1 className="text-2xl font-bold text-white mt-2">
              Unidad {unit?.name ?? "—"}
            </h1>
            <p className="text-gray-400 text-sm mt-0.5">{unit?.owner_name}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 uppercase tracking-widest">Total pagado</p>
            <p className="text-xl font-bold text-green-400 mt-0.5">{formatCurrency(totalPaid)}</p>
            <p className="text-xs text-gray-600">{payments.length} pago{payments.length !== 1 ? "s" : ""}</p>
          </div>
        </div>

        {/* Payment list grouped by month */}
        {payments.length === 0 ? (
          <div className="rounded-2xl bg-gray-900 border border-gray-800 px-6 py-10 text-center">
            <p className="text-gray-500">Sin pagos registrados.</p>
          </div>
        ) : (
          sortedMonths.map(month => {
            const mPayments = byMonth[month];
            const monthTotal = mPayments.reduce((a, p) => a + Number(p.amount), 0);
            return (
              <div key={month} className="rounded-2xl overflow-hidden border border-gray-800">
                {/* Month header */}
                <div className="bg-blue-900/60 border-b border-blue-800/60 px-5 py-3 flex items-center justify-between">
                  <span className="text-sm font-bold text-blue-200 uppercase tracking-widest">
                    {formatMonthLabel(month)}
                  </span>
                  <span className="text-sm font-bold text-white">{formatCurrency(monthTotal)}</span>
                </div>

                {/* Payment rows */}
                <div className="divide-y divide-gray-800">
                  {mPayments.map(p => (
                    <div key={p.id} className="flex items-center justify-between px-5 py-4 bg-gray-900 hover:bg-gray-800 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{p.method === "efectivo" ? "💵" : "🏦"}</span>
                        <div>
                          <p className="text-base font-bold text-white">{formatCurrency(Number(p.amount))}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-sm text-gray-400">{formatDate(p.date)}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              p.method === "efectivo"
                                ? "bg-green-900/50 text-green-300"
                                : "bg-blue-900/50 text-blue-300"
                            }`}>
                              {p.method === "efectivo" ? "Efectivo" : "Transferencia"}
                            </span>
                          </div>
                          {p.notes && (
                            <p className="text-xs text-gray-500 italic mt-0.5">{p.notes}</p>
                          )}
                        </div>
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
