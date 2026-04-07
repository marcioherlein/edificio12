"use client";
import { formatCurrency } from "@/lib/utils";

export interface MonthBalance {
  month: string;
  caja: number;
  uala: number;
  ingresos: number;
  egresos: number;
}

export default function BalanceChart({ data }: { data: MonthBalance[] }) {
  if (data.length === 0) return null;

  const BAR_H = 96;
  const allValues = data.flatMap(d => [d.ingresos, d.egresos, d.caja + d.uala]);
  const maxVal = Math.max(...allValues, 1);

  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <div className="flex items-end gap-3 min-w-max px-1 pt-6">
          {data.map(({ month, caja, uala, ingresos, egresos }) => {
            const total = caja + uala;
            const ingH   = (ingresos / maxVal) * BAR_H;
            const egH    = (egresos  / maxVal) * BAR_H;
            const totH   = (total    / maxVal) * BAR_H;
            const [yr, mo] = month.split("-").map(Number);
            const label = new Date(yr, mo - 1, 1)
              .toLocaleDateString("es-AR", { month: "short" })
              .replace(".", "");

            return (
              <div key={month} className="flex flex-col items-center gap-1.5" style={{ width: 56 }}>
                {/* Total label */}
                <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">
                  {shortCurrency(total)}
                </span>
                {/* Three bars side by side */}
                <div className="flex items-end gap-0.5 w-full" style={{ height: BAR_H }}>
                  <div
                    className="flex-1 rounded-t bg-green-400 transition-all"
                    style={{ height: ingH || 2 }}
                    title={`Ingresos: ${formatCurrency(ingresos)}`}
                  />
                  <div
                    className="flex-1 rounded-t bg-red-400 transition-all"
                    style={{ height: egH || 2 }}
                    title={`Egresos: ${formatCurrency(egresos)}`}
                  />
                  <div
                    className="flex-1 rounded-t bg-blue-500 transition-all"
                    style={{ height: totH || 2 }}
                    title={`Total fondo: ${formatCurrency(total)}`}
                  />
                </div>
                {/* Month label */}
                <span className="text-[11px] text-gray-500 font-medium capitalize">{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-2 px-1 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-green-400" />
          <span className="text-[10px] text-gray-400">Ingresos</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-red-400" />
          <span className="text-[10px] text-gray-400">Egresos</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
          <span className="text-[10px] text-gray-400">Fondo total</span>
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
