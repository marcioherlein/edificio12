"use client";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDate, formatMonthLabel } from "@/lib/utils";
import Card from "@/components/ui/Card";

interface Unit { id: string; name: string; owner_name: string; }
interface Expense { id: string; description: string; amount: number; method: string; date: string; category: string; }
interface AccountBalance { cash_opening: number; bank_opening: number; bank_interest: number; }

interface Props {
  month: string;
  availableMonths: string[];
  units: Unit[];
  feeAmount: number;
  openingByUnit: Record<string, number>;
  cashByUnit: Record<string, number>;
  transferByUnit: Record<string, number>;
  lastDateByUnit: Record<string, string>;
  expenses: Expense[];
  accountBalance: AccountBalance | null;
}

// 8-column grid: Depto | Propietario | Anterior | Expensa | Efectivo | Transf. | Fecha | Saldo
const ING_COLS = "grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr_1.4fr_1.1fr]";

export default function ResumenClient({
  month, availableMonths, units, feeAmount,
  openingByUnit, cashByUnit, transferByUnit, lastDateByUnit,
  expenses, accountBalance,
}: Props) {
  const router = useRouter();

  // ── Computed values ──────────────────────────────────────
  const cashIn          = Object.values(cashByUnit).reduce((a, b) => a + b, 0);
  const transferIn      = Object.values(transferByUnit).reduce((a, b) => a + b, 0);
  const bankInterest    = accountBalance?.bank_interest ?? 0;
  const cashOpening     = accountBalance?.cash_opening ?? 0;
  const bankOpening     = accountBalance?.bank_opening ?? 0;
  const cashExpenses    = expenses.filter(e => e.method === "efectivo").reduce((a, e) => a + e.amount, 0);
  const transferExpenses = expenses.filter(e => e.method !== "efectivo").reduce((a, e) => a + e.amount, 0);
  const cashClosing     = cashOpening + cashIn - cashExpenses;
  const bankClosing     = bankOpening + transferIn + bankInterest - transferExpenses;

  const totalAnterior   = units.reduce((a, u) => a + (openingByUnit[u.id] ?? 0), 0);
  const totalSaldo      = units.reduce((a, u) => {
    const ant = openingByUnit[u.id] ?? 0;
    return a + Math.max(0, ant + feeAmount - (cashByUnit[u.id] ?? 0) - (transferByUnit[u.id] ?? 0));
  }, 0);

  const [yr, mo] = month.split("-").map(Number);
  const lastDay = new Date(yr, mo, 0).getDate();
  const closingDateLabel = `${String(lastDay).padStart(2, "0")}/${String(mo).padStart(2, "0")}/${yr}`;

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-gray-900 pt-2">Resumen mensual</h1>

      {/* Month selector */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {availableMonths.map(m => (
          <button
            key={m}
            onClick={() => router.push(`/resumen?month=${m}`)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              m === month
                ? "bg-gray-900 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:border-gray-400"
            }`}
          >
            {formatMonthLabel(m)}
          </button>
        ))}
      </div>

      {/* ── INGRESOS ─────────────────────────────────────────── */}
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2 px-1">
          Ingresos
        </h2>
        <Card padding={false}>
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900">
              Expensas — {formatMonthLabel(month)}
            </span>
            <div className="flex gap-3 text-xs">
              <span className="text-gray-400">
                💵 <span className="text-green-700 font-semibold">{formatCurrency(cashIn)}</span>
              </span>
              <span className="text-gray-400">
                🏦 <span className="text-blue-700 font-semibold">{formatCurrency(transferIn + bankInterest)}</span>
              </span>
            </div>
          </div>

          {/* Desktop header */}
          <div className={`hidden sm:grid ${ING_COLS} gap-x-2 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400 border-b border-gray-100`}>
            <span>Depto</span>
            <span>Propietario</span>
            <span className="text-right">Anterior</span>
            <span className="text-right">Expensa</span>
            <span className="text-right">Efectivo</span>
            <span className="text-right">Transf.</span>
            <span className="text-right">Fecha</span>
            <span className="text-right">{closingDateLabel}</span>
          </div>

          <div className="divide-y divide-gray-50">
            {units.map(unit => {
              const anterior = openingByUnit[unit.id] ?? 0;
              const cash     = cashByUnit[unit.id] ?? 0;
              const transfer = transferByUnit[unit.id] ?? 0;
              const saldo    = anterior + feeAmount - cash - transfer;
              const lastDate = lastDateByUnit[unit.id];

              return (
                <div key={unit.id} className={`sm:grid ${ING_COLS} gap-x-2 px-4 py-2.5`}>
                  {/* Mobile */}
                  <div className="sm:hidden flex items-center justify-between">
                    <div>
                      <span className="text-sm font-semibold text-gray-800">{unit.name}</span>
                      <span className="text-xs text-gray-400 ml-2">{unit.owner_name}</span>
                      {anterior > 0 && (
                        <span className="block text-xs text-amber-600 mt-0.5">
                          Ant: {formatCurrency(anterior)}
                        </span>
                      )}
                    </div>
                    <div className="text-right space-y-0.5">
                      {cash > 0 && <div className="text-xs text-green-700">💵 {formatCurrency(cash)}</div>}
                      {transfer > 0 && <div className="text-xs text-blue-700">🏦 {formatCurrency(transfer)}</div>}
                      <div className={`text-xs font-semibold ${saldo > 0 ? "text-amber-600" : "text-gray-300"}`}>
                        {saldo > 0 ? formatCurrency(saldo) : "—"}
                      </div>
                    </div>
                  </div>

                  {/* Desktop */}
                  <span className="hidden sm:block text-sm font-semibold text-gray-800 self-center">{unit.name}</span>
                  <span className="hidden sm:block text-xs text-gray-500 self-center truncate">{unit.owner_name}</span>
                  <span className={`hidden sm:block text-xs text-right self-center ${anterior > 0 ? "text-amber-600 font-medium" : "text-gray-300"}`}>
                    {anterior > 0 ? formatCurrency(anterior) : "—"}
                  </span>
                  <span className="hidden sm:block text-xs text-right self-center text-gray-600">
                    {feeAmount > 0 ? formatCurrency(feeAmount) : "—"}
                  </span>
                  <span className={`hidden sm:block text-xs text-right self-center ${cash > 0 ? "text-green-700 font-medium" : "text-gray-300"}`}>
                    {cash > 0 ? formatCurrency(cash) : "—"}
                  </span>
                  <span className={`hidden sm:block text-xs text-right self-center ${transfer > 0 ? "text-blue-700 font-medium" : "text-gray-300"}`}>
                    {transfer > 0 ? formatCurrency(transfer) : "—"}
                  </span>
                  <span className="hidden sm:block text-xs text-right self-center text-gray-400">
                    {lastDate ? formatDate(lastDate) : "—"}
                  </span>
                  <span className={`hidden sm:block text-xs text-right self-center font-medium ${saldo > 0 ? "text-amber-600" : "text-gray-300"}`}>
                    {saldo > 0 ? formatCurrency(saldo) : "—"}
                  </span>
                </div>
              );
            })}

            {/* Interests row */}
            {bankInterest > 0 && (
              <div className={`sm:grid ${ING_COLS} gap-x-2 px-4 py-2 bg-blue-50/50`}>
                <div className="sm:hidden flex items-center justify-between">
                  <span className="text-xs font-medium text-blue-700">Intereses Uala</span>
                  <span className="text-xs text-blue-700 font-medium">🏦 {formatCurrency(bankInterest)}</span>
                </div>
                <span className="hidden sm:block text-xs font-medium text-blue-700 self-center">Intereses Uala</span>
                <span className="hidden sm:block" /><span className="hidden sm:block" />
                <span className="hidden sm:block" /><span className="hidden sm:block" />
                <span className="hidden sm:block text-xs text-right self-center text-blue-700 font-medium">
                  {formatCurrency(bankInterest)}
                </span>
                <span className="hidden sm:block" /><span className="hidden sm:block" />
              </div>
            )}

            {/* Totals row */}
            <div className={`sm:grid ${ING_COLS} gap-x-2 px-4 py-2.5 bg-gray-50 border-t border-gray-200`}>
              <div className="sm:hidden flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700">Total</span>
                <div className="text-right">
                  <div className="text-xs text-green-700 font-bold">{formatCurrency(cashIn)}</div>
                  <div className="text-xs text-blue-700 font-bold">{formatCurrency(transferIn + bankInterest)}</div>
                </div>
              </div>
              <span className="hidden sm:block text-xs font-bold text-gray-700 self-center">Total</span>
              <span className="hidden sm:block" />
              <span className="hidden sm:block text-xs text-right self-center font-bold text-gray-700">
                {totalAnterior > 0 ? formatCurrency(totalAnterior) : "—"}
              </span>
              <span className="hidden sm:block text-xs text-right self-center font-bold text-gray-700">
                {feeAmount > 0 ? formatCurrency(units.length * feeAmount) : "—"}
              </span>
              <span className="hidden sm:block text-xs text-right self-center font-bold text-green-700">
                {formatCurrency(cashIn)}
              </span>
              <span className="hidden sm:block text-xs text-right self-center font-bold text-blue-700">
                {formatCurrency(transferIn + bankInterest)}
              </span>
              <span className="hidden sm:block" />
              <span className="hidden sm:block text-xs text-right self-center font-bold text-amber-600">
                {totalSaldo > 0 ? formatCurrency(totalSaldo) : "—"}
              </span>
            </div>
          </div>
        </Card>
      </section>

      {/* ── EGRESOS ───────────────────────────────────────────── */}
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2 px-1">
          Egresos
        </h2>
        <Card padding={false}>
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900">
              Gastos — {formatMonthLabel(month)}
            </span>
            <div className="flex gap-3 text-xs">
              {cashExpenses > 0 && (
                <span className="text-gray-400">
                  💵 <span className="text-green-700 font-semibold">{formatCurrency(cashExpenses)}</span>
                </span>
              )}
              {transferExpenses > 0 && (
                <span className="text-gray-400">
                  🏦 <span className="text-red-600 font-semibold">{formatCurrency(transferExpenses)}</span>
                </span>
              )}
            </div>
          </div>

          {/* Desktop header */}
          <div className="hidden sm:grid grid-cols-[3fr_2fr_1.2fr_1.2fr] gap-x-2 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400 border-b border-gray-100">
            <span>Descripción</span>
            <span>Categoría</span>
            <span className="text-right">Efectivo</span>
            <span className="text-right">Transferencia</span>
          </div>

          <div className="divide-y divide-gray-50">
            {expenses.length === 0 ? (
              <p className="text-sm text-gray-400 px-4 py-6 text-center">
                Sin egresos registrados para este mes.
              </p>
            ) : (
              expenses.map(exp => (
                <div key={exp.id} className="sm:grid grid-cols-[3fr_2fr_1.2fr_1.2fr] gap-x-2 px-4 py-2.5">
                  {/* Mobile */}
                  <div className="sm:hidden flex items-center justify-between">
                    <div>
                      <span className="text-sm text-gray-800">{exp.description}</span>
                      <span className="block text-xs text-gray-400 mt-0.5">
                        {exp.category} · {formatDate(exp.date)}
                      </span>
                    </div>
                    <span className={`text-sm font-semibold ml-3 shrink-0 ${exp.method === "efectivo" ? "text-green-700" : "text-red-600"}`}>
                      {exp.method === "efectivo" ? "💵" : "🏦"} {formatCurrency(exp.amount)}
                    </span>
                  </div>

                  {/* Desktop */}
                  <div className="hidden sm:block self-center">
                    <span className="text-sm text-gray-800">{exp.description}</span>
                    <span className="block text-xs text-gray-400">{formatDate(exp.date)}</span>
                  </div>
                  <span className="hidden sm:block text-xs text-gray-500 self-center">{exp.category}</span>
                  <span className={`hidden sm:block text-xs text-right self-center font-medium ${exp.method === "efectivo" ? "text-green-700" : "text-gray-300"}`}>
                    {exp.method === "efectivo" ? formatCurrency(exp.amount) : "—"}
                  </span>
                  <span className={`hidden sm:block text-xs text-right self-center font-medium ${exp.method !== "efectivo" ? "text-red-600" : "text-gray-300"}`}>
                    {exp.method !== "efectivo" ? formatCurrency(exp.amount) : "—"}
                  </span>
                </div>
              ))
            )}

            {/* Totals row */}
            {expenses.length > 0 && (
              <div className="sm:grid grid-cols-[3fr_2fr_1.2fr_1.2fr] gap-x-2 px-4 py-2.5 bg-gray-50 border-t border-gray-200">
                <div className="sm:hidden flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700">Total</span>
                  <div className="text-right">
                    {cashExpenses > 0 && <div className="text-xs text-green-700 font-bold">{formatCurrency(cashExpenses)}</div>}
                    {transferExpenses > 0 && <div className="text-xs text-red-600 font-bold">{formatCurrency(transferExpenses)}</div>}
                  </div>
                </div>
                <span className="hidden sm:block text-xs font-bold text-gray-700 self-center">Total</span>
                <span className="hidden sm:block" />
                <span className="hidden sm:block text-xs text-right self-center font-bold text-green-700">
                  {cashExpenses > 0 ? formatCurrency(cashExpenses) : "—"}
                </span>
                <span className="hidden sm:block text-xs text-right self-center font-bold text-red-600">
                  {transferExpenses > 0 ? formatCurrency(transferExpenses) : "—"}
                </span>
              </div>
            )}
          </div>
        </Card>
      </section>

      {/* ── BALANCE ───────────────────────────────────────────── */}
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2 px-1">
          Balance
        </h2>
        <Card padding={false}>
          {/* Column header */}
          <div className="grid grid-cols-[3fr_1.5fr_1.5fr_1.5fr] gap-x-2 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400 border-b border-gray-100">
            <span />
            <span className="text-right">Caja</span>
            <span className="text-right">Uala</span>
            <span className="text-right">Total</span>
          </div>

          <div className="divide-y divide-gray-100">
            {/* Opening */}
            <BalanceRow
              label="Saldo apertura"
              cash={cashOpening}
              bank={bankOpening}
            />

            {/* Ingresos expensas */}
            <BalanceRow
              label="+ Ingresos expensas"
              cash={cashIn}
              bank={transferIn}
              cashColor="text-green-700"
              bankColor="text-green-700"
            />

            {/* Intereses */}
            {bankInterest > 0 && (
              <BalanceRow
                label="+ Intereses Uala"
                cash={null}
                bank={bankInterest}
                bankColor="text-blue-600"
                totalColor="text-blue-600"
              />
            )}

            {/* Egresos */}
            <BalanceRow
              label="− Egresos"
              cash={cashExpenses}
              bank={transferExpenses}
              cashColor="text-red-600"
              bankColor="text-red-600"
            />
          </div>

          {/* Closing balance — dark row */}
          <div className="grid grid-cols-[3fr_1.5fr_1.5fr_1.5fr] gap-x-2 px-4 py-3.5 bg-gray-900 rounded-b-xl">
            <span className="text-sm font-bold text-white">= Saldo {closingDateLabel}</span>
            <span className="text-sm text-right font-bold text-white">{formatCurrency(cashClosing)}</span>
            <span className="text-sm text-right font-bold text-white">{formatCurrency(bankClosing)}</span>
            <span className="text-sm text-right font-bold text-green-400">
              {formatCurrency(cashClosing + bankClosing)}
            </span>
          </div>
        </Card>
      </section>

      <div className="h-4" />
    </div>
  );
}

function BalanceRow({
  label,
  cash,
  bank,
  cashColor = "text-gray-700",
  bankColor = "text-gray-700",
  totalColor = "text-gray-700",
}: {
  label: string;
  cash: number | null;
  bank: number;
  cashColor?: string;
  bankColor?: string;
  totalColor?: string;
}) {
  const total = (cash ?? 0) + bank;
  return (
    <div className="grid grid-cols-[3fr_1.5fr_1.5fr_1.5fr] gap-x-2 px-4 py-3">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`text-sm text-right ${cashColor}`}>
        {cash === null ? <span className="text-gray-300">—</span> : formatCurrency(cash)}
      </span>
      <span className={`text-sm text-right ${bankColor}`}>{formatCurrency(bank)}</span>
      <span className={`text-sm text-right ${totalColor}`}>{formatCurrency(total)}</span>
    </div>
  );
}
