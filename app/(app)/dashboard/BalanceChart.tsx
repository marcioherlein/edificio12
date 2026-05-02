"use client";
import { formatCurrency } from "@/lib/utils";

export interface MonthBalance {
  month: string;
  caja: number;
  belo: number;
  ingresos: number;
  egresos: number;
}

export default function BalanceChart({ data }: { data: MonthBalance[] }) {
  if (data.length === 0) return null;

  const BAR_H = 160;
  const allValues = data.flatMap(d => [d.ingresos, d.egresos, d.caja + d.belo]);
  const maxVal = Math.max(...allValues, 1);

  return (
    <div>
      <div className="overflow-x-auto pb-2">
        <div className="flex items-end gap-4 min-w-max px-1 pt-8">
          {data.map(({ month, caja, belo, ingresos, egresos }) => {
            const total = caja + belo;
            const ingH  = Math.max((ingresos / maxVal) * BAR_H, 3);
            const egH   = Math.max((egresos  / maxVal) * BAR_H, 3);
            const totH  = Math.max((total    / maxVal) * BAR_H, 3);
            const [yr, mo] = month.split("-").map(Number);
            const label = new Date(yr, mo - 1, 1)
              .toLocaleDateString("es-AR", { month: "short" })
              .replace(".", "");

            return (
              <div key={month} className="flex flex-col items-center gap-2" style={{ width: 64 }}>
                <span className="text-[11px] font-semibold whitespace-nowrap" style={{ color: "#94a3b8" }}>
                  {shortCurrency(total)}
                </span>
                <div className="flex items-end gap-1 w-full" style={{ height: BAR_H }}>
                  <div
                    className="flex-1 rounded-t transition-all"
                    style={{ height: ingH, background: "#22c55e" }}
                    title={`Ingresos: ${formatCurrency(ingresos)}`}
                  />
                  <div
                    className="flex-1 rounded-t transition-all"
                    style={{ height: egH, background: "#ef4444" }}
                    title={`Egresos: ${formatCurrency(egresos)}`}
                  />
                  <div
                    className="flex-1 rounded-t transition-all"
                    style={{ height: totH, background: "#3b82f6" }}
                    title={`Total fondo: ${formatCurrency(total)}`}
                  />
                </div>
                <span className="text-xs font-medium capitalize" style={{ color: "#64748b" }}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-5 mt-3 px-1 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ background: "#22c55e" }} />
          <span className="text-xs" style={{ color: "#64748b" }}>Ingresos</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ background: "#ef4444" }} />
          <span className="text-xs" style={{ color: "#64748b" }}>Egresos</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ background: "#3b82f6" }} />
          <span className="text-xs" style={{ color: "#64748b" }}>Fondo total</span>
        </div>
      </div>
    </div>
  );
}

function shortCurrency(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}
