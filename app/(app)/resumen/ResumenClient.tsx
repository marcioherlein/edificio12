"use client";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDate, formatMonthLabel } from "@/lib/utils";
import Modal from "@/components/ui/Modal";
import PaymentForm from "@/components/admin/PaymentForm";
import ExpenseForm from "@/components/admin/ExpenseForm";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Unit { id: string; name: string; owner_name: string; }
interface Payment { id: string; unit_id: string; amount: number; method: string; month: string; date: string; notes: string | null; }
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
  payments: Payment[];
  expenses: Expense[];
  accountBalance: AccountBalance | null;
  isAdmin: boolean;
  categories: { id: string; name: string }[];
}

// 8 columns: Depto | Propietario | Anterior | Expensa | Efectivo | Transf. | Fecha | Saldo
const ING_COLS = "grid-cols-[1.8fr_2.2fr_1.2fr_1.2fr_1.2fr_1.2fr_1.4fr_1.2fr]";

export default function ResumenClient({
  month, availableMonths, units, feeAmount,
  openingByUnit, cashByUnit, transferByUnit, lastDateByUnit,
  payments, expenses, accountBalance, isAdmin, categories,
}: Props) {
  const router = useRouter();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null);
  const [editPayment, setEditPayment] = useState<Payment | null>(null);

  const paymentsByUnit: Record<string, Payment[]> = {};
  for (const p of payments) {
    if (!paymentsByUnit[p.unit_id]) paymentsByUnit[p.unit_id] = [];
    paymentsByUnit[p.unit_id].push(p);
  }

  function onPaymentSuccess() { setPaymentOpen(false); router.refresh(); }
  function onExpenseSuccess() { setExpenseOpen(false); router.refresh(); }
  function onEditSuccess() { setEditPayment(null); router.refresh(); }

  // ── Computed values ──────────────────────────────────────
  const cashIn           = Object.values(cashByUnit).reduce((a, b) => a + b, 0);
  const transferIn       = Object.values(transferByUnit).reduce((a, b) => a + b, 0);
  const bankInterest     = accountBalance?.bank_interest ?? 0;
  const cashOpening      = accountBalance?.cash_opening ?? 0;
  const bankOpening      = accountBalance?.bank_opening ?? 0;
  const cashExpenses     = expenses.filter(e => e.method === "efectivo").reduce((a, e) => a + e.amount, 0);
  const transferExpenses = expenses.filter(e => e.method !== "efectivo").reduce((a, e) => a + e.amount, 0);
  const cashClosing      = cashOpening + cashIn - cashExpenses;
  const bankClosing      = bankOpening + transferIn + bankInterest - transferExpenses;

  const totalAnterior = units.reduce((a, u) => a + (openingByUnit[u.id] ?? 0), 0);
  const totalSaldo    = units.reduce((a, u) => {
    const ant = openingByUnit[u.id] ?? 0;
    return a + Math.max(0, ant + feeAmount - (cashByUnit[u.id] ?? 0) - (transferByUnit[u.id] ?? 0));
  }, 0);

  const [yr, mo] = month.split("-").map(Number);
  const lastDay = new Date(yr, mo, 0).getDate();
  const closingDateLabel = `${String(lastDay).padStart(2, "0")}/${String(mo).padStart(2, "0")}/${yr}`;

  return (
    <div className="min-h-screen bg-gray-950 pb-24">
      <div className="max-w-5xl mx-auto px-4 pt-6 space-y-8">

        {/* ── Page title ─────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Resumen mensual</h1>
          <p className="text-blue-400 text-sm mt-0.5">{formatMonthLabel(month)}</p>
        </div>

        {/* ── Month selector ─────────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {availableMonths.map(m => (
            <button
              key={m}
              onClick={() => router.push(`/resumen?month=${m}`)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                m === month
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white"
              }`}
            >
              {formatMonthLabel(m)}
            </button>
          ))}
        </div>

        {/* ════════════════════════════════════════════════
            INGRESOS
        ════════════════════════════════════════════════ */}
        <section>
          {/* Section label */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="w-1 h-6 bg-blue-500 rounded-full" />
              <h2 className="text-lg font-bold text-white">Ingresos</h2>
              <span className="text-blue-400 text-sm font-medium">{formatMonthLabel(month)}</span>
            </div>
            {isAdmin && (
              <button
                onClick={() => setPaymentOpen(true)}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-lg shadow-blue-900/30"
              >
                <span className="text-base leading-none">+</span> Registrar pago
              </button>
            )}
          </div>

          <div className="rounded-2xl overflow-hidden border border-gray-800 shadow-2xl">
            {/* Column headers */}
            <div className={`hidden sm:grid ${ING_COLS} gap-x-3 px-5 py-3 bg-blue-900/60 border-b border-blue-800/60`}>
              <span className="text-xs font-bold uppercase tracking-widest text-blue-200">Depto</span>
              <span className="text-xs font-bold uppercase tracking-widest text-blue-200">Propietario</span>
              <span className="text-xs font-bold uppercase tracking-widest text-blue-200 text-right">Anterior</span>
              <span className="text-xs font-bold uppercase tracking-widest text-blue-200 text-right">Expensa</span>
              <span className="text-xs font-bold uppercase tracking-widest text-blue-200 text-right">Efectivo</span>
              <span className="text-xs font-bold uppercase tracking-widest text-blue-200 text-right">Transf.</span>
              <span className="text-xs font-bold uppercase tracking-widest text-blue-200 text-right">Fecha pago</span>
              <span className="text-xs font-bold uppercase tracking-widest text-blue-200 text-right">{closingDateLabel}</span>
            </div>

            {/* Unit rows */}
            {units.map((unit, idx) => {
              const anterior   = openingByUnit[unit.id] ?? 0;
              const cash       = cashByUnit[unit.id] ?? 0;
              const transfer   = transferByUnit[unit.id] ?? 0;
              const saldo      = anterior + feeAmount - cash - transfer;
              const lastDate   = lastDateByUnit[unit.id];
              const expanded   = expandedUnit === unit.id;
              const unitPays   = paymentsByUnit[unit.id] ?? [];
              const isPaid     = saldo <= 0;
              const rowBg      = idx % 2 === 0 ? "bg-gray-900" : "bg-gray-900/60";

              return (
                <div key={unit.id} className="border-b border-gray-800 last:border-b-0">
                  {/* Main row */}
                  <div
                    onClick={() => setExpandedUnit(expanded ? null : unit.id)}
                    className={`${rowBg} ${expanded ? "bg-blue-950/80" : ""} cursor-pointer hover:bg-gray-800 transition-colors`}
                  >
                    {/* Mobile layout */}
                    <div className="sm:hidden flex items-center justify-between px-4 py-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold text-white">{unit.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${isPaid ? "bg-green-900/60 text-green-300" : "bg-amber-900/60 text-amber-300"}`}>
                            {isPaid ? "Al día" : `Debe ${formatCurrency(saldo)}`}
                          </span>
                        </div>
                        <p className="text-sm text-gray-400 mt-0.5">{unit.owner_name}</p>
                        {anterior > 0 && <p className="text-xs text-amber-400 mt-0.5">Anterior: {formatCurrency(anterior)}</p>}
                      </div>
                      <div className="text-right space-y-1">
                        {cash > 0 && <div className="text-sm font-semibold text-green-400">💵 {formatCurrency(cash)}</div>}
                        {transfer > 0 && <div className="text-sm font-semibold text-blue-400">🏦 {formatCurrency(transfer)}</div>}
                        <span className="text-gray-600 text-xs">{expanded ? "▲" : "▼"}</span>
                      </div>
                    </div>

                    {/* Desktop layout */}
                    <div className={`hidden sm:grid ${ING_COLS} gap-x-3 px-5 py-3.5 items-center`}>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-white">{unit.name}</span>
                        <span className="text-gray-500 text-xs">{expanded ? "▲" : "▼"}</span>
                      </div>
                      <span className="text-sm text-gray-300 truncate">{unit.owner_name}</span>
                      <span className={`text-sm text-right font-medium ${anterior > 0 ? "text-amber-400" : "text-gray-700"}`}>
                        {anterior > 0 ? formatCurrency(anterior) : "—"}
                      </span>
                      <span className="text-sm text-right text-gray-400">
                        {feeAmount > 0 ? formatCurrency(feeAmount) : "—"}
                      </span>
                      <span className={`text-sm text-right font-semibold ${cash > 0 ? "text-green-400" : "text-gray-700"}`}>
                        {cash > 0 ? formatCurrency(cash) : "—"}
                      </span>
                      <span className={`text-sm text-right font-semibold ${transfer > 0 ? "text-blue-400" : "text-gray-700"}`}>
                        {transfer > 0 ? formatCurrency(transfer) : "—"}
                      </span>
                      <span className="text-sm text-right text-gray-500">
                        {lastDate ? formatDate(lastDate) : "—"}
                      </span>
                      <span className={`text-sm text-right font-bold ${saldo > 0 ? "text-amber-400" : "text-green-400"}`}>
                        {saldo > 0 ? formatCurrency(saldo) : "✓"}
                      </span>
                    </div>
                  </div>

                  {/* Expanded payment detail */}
                  {expanded && (
                    <div className="bg-blue-950/40 border-t border-blue-900/40 px-5 py-4 space-y-2">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
                          Pagos registrados — {unit.name} · {unit.owner_name}
                        </p>
                        <a
                          href={`/unidad/${unit.id}`}
                          className="text-xs font-semibold text-blue-400 hover:text-blue-200 bg-blue-900/40 hover:bg-blue-800/60 px-3 py-1.5 rounded-lg transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Ver historial completo →
                        </a>
                      </div>
                      {unitPays.length === 0 ? (
                        <p className="text-sm text-gray-500 py-2">Sin pagos registrados este mes.</p>
                      ) : (
                        unitPays.map(p => (
                          <div key={p.id} className="flex items-center justify-between bg-gray-900 border border-gray-700 rounded-xl px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span className="text-xl">{p.method === "efectivo" ? "💵" : "🏦"}</span>
                              <div>
                                <span className="text-base font-bold text-white">{formatCurrency(p.amount)}</span>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  <span className="text-sm text-gray-400">{formatDate(p.date)}</span>
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${p.method === "efectivo" ? "bg-green-900/50 text-green-300" : "bg-blue-900/50 text-blue-300"}`}>
                                    {p.method === "efectivo" ? "Efectivo" : "Transferencia"}
                                  </span>
                                  {p.month !== month && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-900/50 text-amber-300 font-medium">
                                      cubre {formatMonthLabel(p.month)}
                                    </span>
                                  )}
                                  {p.notes && <span className="text-xs text-gray-500 italic">{p.notes}</span>}
                                </div>
                              </div>
                            </div>
                            {isAdmin && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditPayment(p); }}
                                className="text-sm font-medium text-blue-400 hover:text-white bg-blue-900/40 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors"
                              >
                                Editar
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Interests row */}
            {bankInterest > 0 && (
              <div className={`hidden sm:grid ${ING_COLS} gap-x-3 px-5 py-3 bg-blue-950/40 border-t border-blue-900/30 items-center`}>
                <span className="text-sm font-semibold text-blue-300 col-span-5">Intereses Uala</span>
                <span className="text-sm text-right font-semibold text-blue-400">{formatCurrency(bankInterest)}</span>
                <span /><span />
              </div>
            )}

            {/* Totals row */}
            <div className={`sm:grid ${ING_COLS} gap-x-3 px-5 py-4 bg-blue-900/40 border-t-2 border-blue-700/60 items-center`}>
              {/* Mobile */}
              <div className="sm:hidden flex justify-between items-center">
                <span className="text-base font-bold text-white">Total</span>
                <div className="text-right">
                  <div className="text-sm font-bold text-green-400">💵 {formatCurrency(cashIn)}</div>
                  <div className="text-sm font-bold text-blue-400">🏦 {formatCurrency(transferIn + bankInterest)}</div>
                </div>
              </div>
              {/* Desktop */}
              <span className="hidden sm:block text-sm font-bold text-white">Total</span>
              <span className="hidden sm:block" />
              <span className="hidden sm:block text-sm text-right font-bold text-amber-300">
                {totalAnterior > 0 ? formatCurrency(totalAnterior) : "—"}
              </span>
              <span className="hidden sm:block text-sm text-right font-bold text-gray-300">
                {feeAmount > 0 ? formatCurrency(units.length * feeAmount) : "—"}
              </span>
              <span className="hidden sm:block text-sm text-right font-bold text-green-400">
                {formatCurrency(cashIn)}
              </span>
              <span className="hidden sm:block text-sm text-right font-bold text-blue-400">
                {formatCurrency(transferIn + bankInterest)}
              </span>
              <span className="hidden sm:block" />
              <span className="hidden sm:block text-sm text-right font-bold text-amber-300">
                {totalSaldo > 0 ? formatCurrency(totalSaldo) : "—"}
              </span>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════
            EGRESOS
        ════════════════════════════════════════════════ */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="w-1 h-6 bg-red-500 rounded-full" />
              <h2 className="text-lg font-bold text-white">Egresos</h2>
              <span className="text-red-400 text-sm font-medium">{formatMonthLabel(month)}</span>
            </div>
            {isAdmin && (
              <button
                onClick={() => setExpenseOpen(true)}
                className="flex items-center gap-1.5 bg-red-700 hover:bg-red-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-lg shadow-red-900/30"
              >
                <span className="text-base leading-none">+</span> Registrar gasto
              </button>
            )}
          </div>

          <div className="rounded-2xl overflow-hidden border border-gray-800 shadow-2xl">
            {/* Column headers */}
            <div className="hidden sm:grid grid-cols-[3fr_2fr_1.4fr_1.4fr] gap-x-3 px-5 py-3 bg-blue-900/60 border-b border-blue-800/60">
              <span className="text-xs font-bold uppercase tracking-widest text-blue-200">Descripción</span>
              <span className="text-xs font-bold uppercase tracking-widest text-blue-200">Categoría</span>
              <span className="text-xs font-bold uppercase tracking-widest text-blue-200 text-right">Efectivo</span>
              <span className="text-xs font-bold uppercase tracking-widest text-blue-200 text-right">Transferencia</span>
            </div>

            {expenses.length === 0 ? (
              <div className="bg-gray-900 px-5 py-10 text-center">
                <p className="text-gray-500 text-base">Sin egresos registrados para este mes.</p>
              </div>
            ) : (
              <>
                {expenses.map((exp, idx) => {
                  const rowBg = idx % 2 === 0 ? "bg-gray-900" : "bg-gray-900/60";
                  return (
                    <div key={exp.id} className={`${rowBg} border-b border-gray-800 last:border-b-0`}>
                      {/* Mobile */}
                      <div className="sm:hidden flex items-center justify-between px-4 py-4">
                        <div>
                          <p className="text-base font-semibold text-white">{exp.description}</p>
                          <p className="text-sm text-gray-400 mt-0.5">{exp.category} · {formatDate(exp.date)}</p>
                        </div>
                        <span className={`text-base font-bold ml-3 shrink-0 ${exp.method === "efectivo" ? "text-green-400" : "text-red-400"}`}>
                          {exp.method === "efectivo" ? "💵" : "🏦"} {formatCurrency(exp.amount)}
                        </span>
                      </div>
                      {/* Desktop */}
                      <div className="hidden sm:grid grid-cols-[3fr_2fr_1.4fr_1.4fr] gap-x-3 px-5 py-3.5 items-center">
                        <div>
                          <p className="text-sm font-semibold text-white">{exp.description}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{formatDate(exp.date)}</p>
                        </div>
                        <span className="text-sm text-gray-400">{exp.category}</span>
                        <span className={`text-sm text-right font-semibold ${exp.method === "efectivo" ? "text-green-400" : "text-gray-700"}`}>
                          {exp.method === "efectivo" ? formatCurrency(exp.amount) : "—"}
                        </span>
                        <span className={`text-sm text-right font-semibold ${exp.method !== "efectivo" ? "text-red-400" : "text-gray-700"}`}>
                          {exp.method !== "efectivo" ? formatCurrency(exp.amount) : "—"}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {/* Totals */}
                <div className="grid grid-cols-[3fr_2fr_1.4fr_1.4fr] gap-x-3 px-5 py-4 bg-blue-900/40 border-t-2 border-blue-700/60 items-center">
                  <div className="sm:hidden flex justify-between col-span-4">
                    <span className="text-base font-bold text-white">Total</span>
                    <div className="text-right">
                      {cashExpenses > 0 && <div className="text-sm font-bold text-green-400">{formatCurrency(cashExpenses)}</div>}
                      {transferExpenses > 0 && <div className="text-sm font-bold text-red-400">{formatCurrency(transferExpenses)}</div>}
                    </div>
                  </div>
                  <span className="hidden sm:block text-sm font-bold text-white">Total</span>
                  <span className="hidden sm:block" />
                  <span className="hidden sm:block text-sm text-right font-bold text-green-400">
                    {cashExpenses > 0 ? formatCurrency(cashExpenses) : "—"}
                  </span>
                  <span className="hidden sm:block text-sm text-right font-bold text-red-400">
                    {transferExpenses > 0 ? formatCurrency(transferExpenses) : "—"}
                  </span>
                </div>
              </>
            )}
          </div>
        </section>

        {/* ════════════════════════════════════════════════
            BALANCE
        ════════════════════════════════════════════════ */}
        <section>
          <div className="flex items-center gap-3 mb-3">
            <span className="w-1 h-6 bg-emerald-500 rounded-full" />
            <h2 className="text-lg font-bold text-white">Balance</h2>
            <span className="text-emerald-400 text-sm font-medium">{formatMonthLabel(month)}</span>
          </div>

          <div className="rounded-2xl overflow-hidden border border-gray-800 shadow-2xl">
            {/* Column header */}
            <div className="grid grid-cols-[3fr_1.5fr_1.5fr_1.5fr] gap-x-3 px-5 py-3 bg-blue-900/60 border-b border-blue-800/60">
              <span className="text-xs font-bold uppercase tracking-widest text-blue-200" />
              <span className="text-xs font-bold uppercase tracking-widest text-blue-200 text-right">💵 Caja</span>
              <span className="text-xs font-bold uppercase tracking-widest text-blue-200 text-right">🏦 Uala</span>
              <span className="text-xs font-bold uppercase tracking-widest text-blue-200 text-right">Total</span>
            </div>

            <DkBalanceRow label="Saldo apertura" cash={cashOpening} bank={bankOpening} />
            <DkBalanceRow label="+ Ingresos expensas" cash={cashIn} bank={transferIn} cashColor="text-green-400" bankColor="text-green-400" totalColor="text-green-400" />
            {bankInterest > 0 && (
              <DkBalanceRow label="+ Intereses Uala" cash={null} bank={bankInterest} bankColor="text-blue-400" totalColor="text-blue-400" />
            )}
            <DkBalanceRow label="− Egresos" cash={cashExpenses} bank={transferExpenses} cashColor="text-red-400" bankColor="text-red-400" totalColor="text-red-400" />

            {/* Closing */}
            <div className="grid grid-cols-[3fr_1.5fr_1.5fr_1.5fr] gap-x-3 px-5 py-5 bg-emerald-900/40 border-t-2 border-emerald-700/60">
              <span className="text-base font-bold text-white">= Saldo {closingDateLabel}</span>
              <span className="text-base text-right font-bold text-white">{formatCurrency(cashClosing)}</span>
              <span className="text-base text-right font-bold text-white">{formatCurrency(bankClosing)}</span>
              <span className="text-base text-right font-bold text-emerald-400">
                {formatCurrency(cashClosing + bankClosing)}
              </span>
            </div>
          </div>
        </section>

        <div className="h-4" />
      </div>

      {/* ── Modals ─────────────────────────────────────────── */}
      {isAdmin && (
        <>
          <Modal open={paymentOpen} onClose={() => setPaymentOpen(false)} title="Registrar pago">
            <PaymentForm
              units={units.map(u => ({ id: u.id, name: u.name }))}
              onSuccess={onPaymentSuccess}
              onCancel={() => setPaymentOpen(false)}
            />
          </Modal>
          <Modal open={expenseOpen} onClose={() => setExpenseOpen(false)} title="Registrar gasto">
            <ExpenseForm
              categories={categories}
              onSuccess={onExpenseSuccess}
              onCancel={() => setExpenseOpen(false)}
            />
          </Modal>
          <Modal open={!!editPayment} onClose={() => setEditPayment(null)} title="Editar pago">
            {editPayment && (
              <EditPaymentForm
                payment={editPayment}
                onSuccess={onEditSuccess}
                onCancel={() => setEditPayment(null)}
              />
            )}
          </Modal>
        </>
      )}
    </div>
  );
}

// ── Dark Balance Row ──────────────────────────────────────────────────────────

function DkBalanceRow({
  label, cash, bank,
  cashColor = "text-gray-300",
  bankColor = "text-gray-300",
  totalColor = "text-gray-300",
}: {
  label: string; cash: number | null; bank: number;
  cashColor?: string; bankColor?: string; totalColor?: string;
}) {
  const total = (cash ?? 0) + bank;
  return (
    <div className="grid grid-cols-[3fr_1.5fr_1.5fr_1.5fr] gap-x-3 px-5 py-4 bg-gray-900 border-b border-gray-800">
      <span className="text-sm font-medium text-gray-300">{label}</span>
      <span className={`text-sm text-right font-semibold ${cashColor}`}>
        {cash === null ? <span className="text-gray-700">—</span> : formatCurrency(cash)}
      </span>
      <span className={`text-sm text-right font-semibold ${bankColor}`}>{formatCurrency(bank)}</span>
      <span className={`text-sm text-right font-semibold ${totalColor}`}>{formatCurrency(total)}</span>
    </div>
  );
}

// ── Edit Payment Form ─────────────────────────────────────────────────────────

function buildMonthOptions(): string[] {
  const options: string[] = [];
  const start = new Date(2025, 11, 1); // December 2025
  const end = new Date(2026, 11, 1);   // December 2026
  for (let d = new Date(end); d >= start; d.setMonth(d.getMonth() - 1)) {
    options.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return options; // Dec 2026 → Dec 2025 (newest first for the edit select)
}

function EditPaymentForm({
  payment, onSuccess, onCancel,
}: {
  payment: Payment; onSuccess: () => void; onCancel: () => void;
}) {
  const supabase = createClient();
  const [amount, setAmount] = useState(String(payment.amount));
  const [method, setMethod] = useState<"efectivo" | "transferencia">(
    payment.method === "efectivo" ? "efectivo" : "transferencia"
  );
  const [date, setDate] = useState(payment.date);
  const [month, setMonth] = useState(payment.month);
  const [notes, setNotes] = useState(payment.notes ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!amount) { setError("Ingresá un monto."); return; }
    setLoading(true);
    const { error: err } = await supabase
      .from("payments")
      .update({ amount: parseFloat(amount), method, date, month, notes: notes || null })
      .eq("id", payment.id);
    if (err) setError("Error al guardar: " + err.message);
    else onSuccess();
    setLoading(false);
  }

  async function handleDelete() {
    setLoading(true);
    const { error: err } = await supabase.from("payments").delete().eq("id", payment.id);
    if (err) { setError("Error al eliminar: " + err.message); setLoading(false); }
    else onSuccess();
  }

  if (confirmDelete) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-700">
          ¿Eliminar pago de <strong>{formatCurrency(payment.amount)}</strong> ({payment.method}) del {formatDate(payment.date)}?
        </p>
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button onClick={() => setConfirmDelete(false)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={handleDelete} disabled={loading} className="px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
            {loading ? "Eliminando…" : "Sí, eliminar"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Monto *</label>
          <input type="number" required min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mes *</label>
          <select value={month} onChange={e => setMonth(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {buildMonthOptions().map(m => <option key={m} value={m}>{formatMonthLabel(m)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Método</label>
        <div className="flex gap-3">
          {(["efectivo", "transferencia"] as const).map(m => (
            <label key={m} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border-2 cursor-pointer transition-colors ${
              method === m ? "border-blue-500 bg-blue-50 text-blue-700 font-medium" : "border-gray-200 text-gray-600 hover:border-gray-300"
            }`}>
              <input type="radio" name="editMethod" value={m} checked={method === m} onChange={() => setMethod(m)} className="sr-only" />
              <span>{m === "efectivo" ? "💵 Efectivo" : "🏦 Transferencia"}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opcional"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      <div className="flex items-center justify-between pt-1">
        <button type="button" onClick={() => setConfirmDelete(true)}
          className="text-sm text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors">
          Eliminar pago
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button type="submit" disabled={loading}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </form>
  );
}
