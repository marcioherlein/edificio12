"use client";
import { formatCurrency } from "@/lib/utils";

export interface MonthBalance {
  month: string;
  caja: number;
  uala: number;
}

export default function BalanceChart({ data }: { data: MonthBalance[] }) {
  if (data.length === 0) return null;

  const maxTotal = Math.max(...data.map(d => d.caja + d.uala), 1);
  const BAR_H = 96;

  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <div className="flex items-end gap-4 min-w-max px-1 pt-6">
          {data.map(({ month, caja, uala }) => {
            const total = caja + uala;
            const totalH = (total / maxTotal) * BAR_H;
            const cajaH = total > 0 ? (caja / total) * totalH : 0;
            const ualaH = totalH - cajaH;
            const [yr, mo] = month.split("-").map(Number);
            const label = new Date(yr, mo - 1, 1)
              .toLocaleDateString("es-AR", { month: "short" })
              .replace(".", "");

            return (
              <div key={month} className="flex flex-col items-center gap-1.5" style={{ width: 52 }}>
                {/* Total label */}
                <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">
                  {shortCurrency(total)}
                </span>
                {/* Stacked bar */}
                <div className="w-full flex flex-col-reverse rounded-t overflow-hidden bg-gray-100"
                  style={{ height: BAR_H }}>
                  <div className="w-full bg-amber-400" style={{ height: cajaH }} title={`Caja: ${formatCurrency(caja)}`} />
                  <div className="w-full bg-blue-500" style={{ height: ualaH }} title={`Uala: ${formatCurrency(uala)}`} />
                </div>
                {/* Month label */}
                <span className="text-[11px] text-gray-500 font-medium capitalize">{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-2 px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
          <span className="text-[10px] text-gray-400">Caja</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
          <span className="text-[10px] text-gray-400">Uala</span>
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
