"use client";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDate, formatMonthLabel, currentMonth as getCurrentMonth, HIDDEN_MONTHS } from "@/lib/utils";
import Modal from "@/components/ui/Modal";
import PaymentForm from "@/components/admin/PaymentForm";
import ExpenseForm from "@/components/admin/ExpenseForm";
import GenerateReceiptButton from "@/components/admin/GenerateReceiptButton";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface Unit { id: string; name: string; owner_name: string; }
interface Payment { id: string; unit_id: string; amount: number; method: string; month: string; date: string; notes: string | null; receipt_url?: string | null; payer_name?: string | null; }
interface Expense { id: string; description?: string | null; amount: number; method: string; date: string; category: string; receipt_url?: string | null; notes?: string | null; }
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
  totalCashIn: number;
  totalTransferIn: number;
  payments: Payment[];
  expenses: Expense[];
  accountBalance: AccountBalance | null;
  isAdmin: boolean;
  isClosed: boolean;
  categories: { id: string; name: string }[];
}

// 8 columns: Depto | Propietario | Anterior | Expensa | Efectivo | Transf. | Fecha | Saldo
const ING_COLS = "grid-cols-[1.8fr_2.2fr_1.2fr_1.2fr_1.2fr_1.2fr_1.4fr_1.2fr]";

/** Month is open for new payments/expenses if it's the current month,
 *  or the previous month within the 5-day grace period. */
function isMonthOpen(month: string): boolean {
  const now = new Date();
  const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  if (month === cur) return true;
  if (now.getDate() <= 5) {
    const prevY = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const prevM = now.getMonth() === 0 ? 12 : now.getMonth();
    const prev = `${prevY}-${String(prevM).padStart(2, "0")}`;
    if (month === prev) return true;
  }
  return false;
}

export default function ResumenClient({
  month, availableMonths, units, feeAmount,
  openingByUnit, cashByUnit, transferByUnit, lastDateByUnit,
  totalCashIn, totalTransferIn,
  payments, expenses, accountBalance, isAdmin, isClosed, categories,
}: Props) {
  const router = useRouter();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null);
  const [editPayment, setEditPayment] = useState<Payment | null>(null);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [payingUnit, setPayingUnit] = useState<Unit | null>(null);
  const canEdit = isAdmin && isMonthOpen(month) && !isClosed;
  const [bankInterestState, setBankInterestState] = useState(accountBalance?.bank_interest ?? 0);

  useEffect(() => {
    setBankInterestState(accountBalance?.bank_interest ?? 0);
  }, [month]);

  const paymentsByUnit: Record<string, Payment[]> = {};
  for (const p of payments) {
    if (!paymentsByUnit[p.unit_id]) paymentsByUnit[p.unit_id] = [];
    paymentsByUnit[p.unit_id].push(p);
  }

  function onPaymentSuccess() { setPaymentOpen(false); setPayingUnit(null); router.refresh(); }
  function onExpenseSuccess() { setExpenseOpen(false); router.refresh(); }
  function onEditSuccess() { setEditPayment(null); router.refresh(); }
  function onEditExpenseSuccess() { setEditExpense(null); router.refresh(); }

  // ── Computed values ──────────────────────────────────────
  const cashIn           = totalCashIn;
  const transferIn       = totalTransferIn;
  const bankInterest     = bankInterestState;
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

  // Next month label for "apertura" reference
  const nextYr = mo === 12 ? yr + 1 : yr;
  const nextMo = mo === 12 ? 1 : mo + 1;
  const nextMonthLabel = formatMonthLabel(`${nextYr}-${String(nextMo).padStart(2, "0")}`);

  return (
    <div className="min-h-screen pb-24" style={{ background: "var(--fiori-page-bg)" }}>
      <div className="max-w-5xl mx-auto px-4 pt-6 space-y-6">

        {/* ── Page title ─────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--fiori-text)" }}>Resumen mensual</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--fiori-blue)" }}>{formatMonthLabel(month)}</p>
        </div>

        {/* ── Month selector ─────────────────────────────── */}
        <div className="flex gap-1 overflow-x-auto pb-0 scrollbar-none border-b" style={{ borderColor: "var(--fiori-border)" }}>
          {availableMonths.map(m => {
            const isCurrent = m === getCurrentMonth();
            const isSelected = m === month;
            return (
              <button
                key={m}
                onClick={() => router.push(`/resumen?month=${m}`)}
                className="px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-all relative"
                style={{
                  color: isSelected ? "var(--fiori-blue)" : "var(--fiori-text-muted)",
                  borderBottom: isSelected ? "2px solid var(--fiori-blue)" : "2px solid transparent",
                  marginBottom: "-1px",
                }}
              >
                {formatMonthLabel(m)}
                {isCurrent && (
                  <span className="ml-2 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                    style={{ background: "var(--fiori-success)", color: "#fff" }}>
                    actual
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Admin month-close panel / closed notice */}
        {isAdmin && isClosed && (
          <div className="border rounded px-4 py-3 flex items-center gap-2"
            style={{ background: "#f9f9f9", borderColor: "var(--fiori-border)" }}>
            <span className="text-sm">🔒</span>
            <p className="text-sm" style={{ color: "var(--fiori-text-muted)" }}>
              <span className="font-semibold" style={{ color: "var(--fiori-text)" }}>{formatMonthLabel(month)}</span> está cerrado — solo lectura.
            </p>
          </div>
        )}
        {isAdmin && canEdit && (
          <SetFeePanel
            month={month}
            feeAmount={feeAmount}
            onSaved={() => router.refresh()}
          />
        )}
        {isAdmin && canEdit && (
          <CloseMonthPanel
            month={month}
            accountBalance={accountBalance}
            feeAmount={feeAmount}
            units={units}
            openingByUnit={openingByUnit}
            cashByUnit={cashByUnit}
            transferByUnit={transferByUnit}
            bankInterest={bankInterest}
            cashClosing={cashClosing}
            bankClosing={bankClosing}
          />
        )}

        {/* ════════════════════════════════════════════════
            INGRESOS
        ════════════════════════════════════════════════ */}
        <section>
          {/* Section label */}
          <div className="flex items-center gap-3 mb-3">
            <span className="w-1 h-5 rounded-full" style={{ background: "var(--fiori-blue)" }} />
            <h2 className="text-base font-bold" style={{ color: "var(--fiori-text)" }}>Ingresos</h2>
            <span className="text-sm font-medium" style={{ color: "var(--fiori-text-muted)" }}>{formatMonthLabel(month)}</span>
          </div>

          <div className="rounded overflow-hidden border" style={{ borderColor: "var(--fiori-border)", background: "#fff" }}>
            {/* Column headers — two-row */}
            <div className="hidden sm:block border-b" style={{ background: "var(--fiori-table-header)", borderColor: "var(--fiori-border)" }}>
              {/* Sub-header: "Medio de pago" spanning cols 5-6 */}
              <div className={`grid ${ING_COLS} gap-x-3 px-5 pt-2`}>
                <span className="col-span-4" />
                <span className="col-span-2 text-center text-[10px] font-bold uppercase tracking-widest pb-1"
                  style={{ color: "var(--fiori-blue)", borderBottom: "1px solid var(--fiori-border)" }}>
                  Medio de pago
                </span>
                <span className="col-span-2" />
              </div>
              {/* Column labels */}
              <div className={`grid ${ING_COLS} gap-x-3 px-5 py-2`}>
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--fiori-text-muted)" }}>Depto</span>
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--fiori-text-muted)" }}>Usuario</span>
                <span className="text-xs font-bold uppercase tracking-widest text-right" style={{ color: "var(--fiori-text-muted)" }}>Deuda Anterior</span>
                <span className="text-xs font-bold uppercase tracking-widest text-right" style={{ color: "var(--fiori-text-muted)" }}>Expensa mensual</span>
                <span className="text-xs font-bold uppercase tracking-widest text-right" style={{ color: "var(--fiori-success)" }}>💵 Efectivo</span>
                <span className="text-xs font-bold uppercase tracking-widest text-right" style={{ color: "var(--fiori-blue)" }}>🏦 Transf.</span>
                <span className="text-xs font-bold uppercase tracking-widest text-right" style={{ color: "var(--fiori-text-muted)" }}>Fecha pago</span>
                <span className="text-xs font-bold uppercase tracking-widest text-right" style={{ color: "var(--fiori-text-muted)" }}>Saldo fin de {formatMonthLabel(month)}</span>
              </div>
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
              const rowBg      = idx % 2 === 0 ? "#ffffff" : "#f8fafc";

              return (
                <div key={unit.id} className="border-b last:border-b-0" style={{ borderColor: "var(--fiori-border)" }}>
                  {/* Main row */}
                  <div
                    onClick={() => setExpandedUnit(expanded ? null : unit.id)}
                    className="cursor-pointer transition-colors hover:bg-[#f8fafc]"
                    style={{ background: expanded ? "#edf4ff" : rowBg }}
                  >
                    {/* ── Mobile layout: 3-line card ── */}
                    <div className="sm:hidden px-4 py-3.5">
                      {/* Line 1: name · owner — status + arrow */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm font-bold truncate" style={{ color: "var(--fiori-text)" }}>{unit.name}</span>
                          <span className="text-xs shrink-0" style={{ color: "var(--fiori-text-muted)" }}>·</span>
                          <span className="text-xs truncate" style={{ color: "var(--fiori-text-muted)" }}>{unit.owner_name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${isPaid
                            ? "bg-[#f0fdf4] text-[#16a34a] border-[#16a34a]/30"
                            : "bg-[#fef6ec] text-[#d97706] border-[#d97706]/30"}`}>
                            {isPaid ? "Al día" : `Debe ${formatCurrency(saldo)}`}
                          </span>
                          <span className="text-xs" style={{ color: "var(--fiori-text-muted)" }}>{expanded ? "▲" : "▼"}</span>
                        </div>
                      </div>
                      {/* Line 2: deuda anterior (only if > 0) */}
                      {anterior > 0 && (
                        <p className="text-xs mt-1.5 font-medium" style={{ color: "var(--fiori-warning)" }}>
                          Deuda anterior: {formatCurrency(anterior)}
                        </p>
                      )}
                      {/* Line 3: payments + saldo */}
                      <div className="flex items-center justify-between mt-1.5 gap-3">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-semibold" style={{ color: cash > 0 ? "var(--fiori-success)" : "var(--fiori-border)" }}>
                            💵 {cash > 0 ? formatCurrency(cash) : "—"}
                          </span>
                          <span className="text-xs font-semibold" style={{ color: transfer > 0 ? "var(--fiori-blue)" : "var(--fiori-border)" }}>
                            🏦 {transfer > 0 ? formatCurrency(transfer) : "—"}
                          </span>
                        </div>
                        <span className="text-xs font-bold" style={{ color: saldo > 0 ? "var(--fiori-warning)" : "var(--fiori-success)" }}>
                          Saldo: {saldo > 0 ? formatCurrency(saldo) : "✓"}
                        </span>
                      </div>
                    </div>

                    {/* Desktop layout */}
                    <div className={`hidden sm:grid ${ING_COLS} gap-x-3 px-5 py-3.5 items-center`}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold" style={{ color: "var(--fiori-text)" }}>{unit.name}</span>
                        <span className="text-xs" style={{ color: "var(--fiori-text-muted)" }}>{expanded ? "▲" : "▼"}</span>
                      </div>
                      <span className="text-sm truncate" style={{ color: "var(--fiori-text-muted)" }}>{unit.owner_name}</span>
                      <span className={`text-sm text-right font-medium`}
                        style={{ color: anterior > 0 ? "var(--fiori-warning)" : "var(--fiori-border)" }}>
                        {anterior > 0 ? formatCurrency(anterior) : "—"}
                      </span>
                      <span className="text-sm text-right" style={{ color: "var(--fiori-text-muted)" }}>
                        {feeAmount > 0 ? formatCurrency(feeAmount) : "—"}
                      </span>
                      <span className="text-sm text-right font-semibold rounded px-1"
                        style={{
                          color: cash > 0 ? "var(--fiori-success)" : "var(--fiori-border)",
                          background: cash > 0 ? "#f0fdf4" : "transparent",
                        }}>
                        {cash > 0 ? formatCurrency(cash) : "—"}
                      </span>
                      <span className="text-sm text-right font-semibold rounded px-1"
                        style={{
                          color: transfer > 0 ? "var(--fiori-blue)" : "var(--fiori-border)",
                          background: transfer > 0 ? "#eff6ff" : "transparent",
                        }}>
                        {transfer > 0 ? formatCurrency(transfer) : "—"}
                      </span>
                      <span className="text-sm text-right" style={{ color: "var(--fiori-text-muted)" }}>
                        {lastDate ? formatDate(lastDate) : "—"}
                      </span>
                      <span className="text-sm text-right font-bold"
                        style={{ color: saldo > 0 ? "var(--fiori-warning)" : "var(--fiori-success)" }}>
                        {saldo > 0 ? formatCurrency(saldo) : "✓"}
                      </span>
                    </div>
                  </div>

                  {/* Expanded payment detail */}
                  {expanded && (
                    <div className="border-t px-5 py-4 space-y-2" style={{ borderColor: "var(--fiori-border)", background: "#f8fafc" }}>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--fiori-text-muted)" }}>
                          Pagos — {unit.name} · {unit.owner_name}
                        </p>
                        <div className="flex items-center gap-2">
                          {canEdit && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setPayingUnit(unit); setPaymentOpen(true); }}
                              className="text-xs font-semibold text-white px-3 py-1.5 rounded transition-colors"
                              style={{ background: "var(--fiori-blue)" }}
                            >
                              + Agregar pago
                            </button>
                          )}
                          <a
                            href={`/unidad/${unit.id}`}
                            className="text-xs font-semibold px-3 py-1.5 rounded transition-colors border"
                            style={{ color: "var(--fiori-blue)", borderColor: "var(--fiori-blue)", background: "#fff" }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            Ver historial →
                          </a>
                        </div>
                      </div>
                      {unitPays.length === 0 ? (
                        <p className="text-sm py-2" style={{ color: "var(--fiori-text-muted)" }}>Sin pagos registrados este mes.</p>
                      ) : (
                        unitPays.map(p => (
                          <div key={p.id} className="flex items-center justify-between bg-white border rounded px-4 py-3"
                            style={{ borderColor: "var(--fiori-border)" }}>
                            <div className="flex items-center gap-3">
                              <span className="text-xl">{p.method === "efectivo" ? "💵" : "🏦"}</span>
                              <div>
                                <span className="text-base font-bold" style={{ color: "var(--fiori-text)" }}>{formatCurrency(p.amount)}</span>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  <span className="text-sm" style={{ color: "var(--fiori-text-muted)" }}>{formatDate(p.date)}</span>
                                  <span className={`text-xs px-2 py-0.5 rounded border font-medium ${
                                    p.method === "efectivo"
                                      ? "bg-[#f0fdf4] text-[#16a34a] border-[#16a34a]/30"
                                      : "bg-[#eff6ff] text-[#3b82f6] border-[#3b82f6]/30"
                                  }`}>
                                    {p.method === "efectivo" ? "Efectivo" : "Transferencia"}
                                  </span>
                                  {p.month !== month && (
                                    <span className="text-xs px-2 py-0.5 rounded border font-medium bg-[#fef6ec] text-[#d97706] border-[#d97706]/30">
                                      cubre {formatMonthLabel(p.month)}
                                    </span>
                                  )}
                                  {p.notes && <span className="text-xs italic" style={{ color: "var(--fiori-text-muted)" }}>{p.notes}</span>}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {isAdmin && (
                                <span onClick={(e) => e.stopPropagation()}>
                                  <GenerateReceiptButton
                                    paymentId={p.id}
                                    defaultName={unit.owner_name}
                                    existingPayerName={p.payer_name}
                                  />
                                </span>
                              )}
                              {p.method !== "efectivo" && p.receipt_url && (
                                <a href={p.receipt_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                                  className="text-xs font-semibold px-2.5 py-1.5 rounded border"
                                  style={{ color: "var(--fiori-blue)", borderColor: "var(--fiori-blue)", background: "#eff6ff" }} title="Ver comprobante transferencia">📎</a>
                              )}
                              {canEdit && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setEditPayment(p); }}
                                  className="text-xs font-semibold px-3 py-1.5 rounded border transition-colors"
                                  style={{ color: "var(--fiori-blue)", borderColor: "var(--fiori-border)", background: "#fff" }}
                                >
                                  Editar
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Totals row */}
            <div className={`sm:grid ${ING_COLS} gap-x-3 px-5 py-4 border-t-2 items-center`}
              style={{ background: "var(--fiori-table-header)", borderColor: "var(--fiori-border)" }}>
              {/* Mobile */}
              <div className="sm:hidden flex justify-between items-center">
                <span className="text-sm font-bold" style={{ color: "var(--fiori-text)" }}>Total</span>
                <div className="text-right">
                  <div className="text-sm font-bold" style={{ color: "var(--fiori-success)" }}>💵 {formatCurrency(cashIn)}</div>
                  <div className="text-sm font-bold" style={{ color: "var(--fiori-blue)" }}>🏦 {formatCurrency(transferIn)}</div>
                </div>
              </div>
              {/* Desktop */}
              <span className="hidden sm:block text-sm font-bold" style={{ color: "var(--fiori-text)" }}>Total</span>
              <span className="hidden sm:block" />
              <span className="hidden sm:block text-sm text-right font-bold" style={{ color: "var(--fiori-warning)" }}>
                {totalAnterior > 0 ? formatCurrency(totalAnterior) : "—"}
              </span>
              <span className="hidden sm:block text-sm text-right font-bold" style={{ color: "var(--fiori-text-muted)" }}>
                {feeAmount > 0 ? formatCurrency(units.length * feeAmount) : "—"}
              </span>
              <span className="hidden sm:block text-sm text-right font-bold rounded px-1"
                style={{ color: "var(--fiori-success)", background: "#f0fdf4" }}>
                {formatCurrency(cashIn)}
              </span>
              <span className="hidden sm:block text-sm text-right font-bold rounded px-1"
                style={{ color: "var(--fiori-blue)", background: "#eff6ff" }}>
                {formatCurrency(transferIn)}
              </span>
              <span className="hidden sm:block" />
              <span className="hidden sm:block text-sm text-right font-bold" style={{ color: "var(--fiori-warning)" }}>
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
              <span className="w-1 h-5 rounded-full" style={{ background: "var(--fiori-error)" }} />
              <h2 className="text-base font-bold" style={{ color: "var(--fiori-text)" }}>Egresos</h2>
              <span className="text-sm font-medium" style={{ color: "var(--fiori-text-muted)" }}>{formatMonthLabel(month)}</span>
            </div>
            {canEdit && (
              <button
                onClick={() => setExpenseOpen(true)}
                className="flex items-center gap-1.5 text-white text-sm font-semibold px-4 py-2 rounded transition-colors"
                style={{ background: "var(--fiori-error)" }}
              >
                <span className="text-base leading-none">+</span> Registrar gasto
              </button>
            )}
          </div>

          <div className="rounded overflow-hidden border" style={{ borderColor: "var(--fiori-border)", background: "#fff" }}>
            {/* Column headers */}
            <div className="hidden sm:flex items-center px-5 py-2 border-b gap-x-3"
              style={{ background: "var(--fiori-table-header)", borderColor: "var(--fiori-border)" }}>
              <div className="flex-1 grid grid-cols-[2.5fr_1.2fr_1.3fr_1.3fr] gap-x-3">
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--fiori-text-muted)" }}>Categoría</span>
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--fiori-text-muted)" }}>Notas</span>
                <span className="text-xs font-bold uppercase tracking-widest text-right" style={{ color: "var(--fiori-text-muted)" }}>Efectivo</span>
                <span className="text-xs font-bold uppercase tracking-widest text-right" style={{ color: "var(--fiori-error)" }}>Transf.</span>
              </div>
              <div className="w-36 shrink-0" />
            </div>

            {expenses.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-base" style={{ color: "var(--fiori-text-muted)" }}>Sin egresos registrados para este mes.</p>
              </div>
            ) : (
              <>
                {expenses.map((exp, idx) => {
                  const rowBg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
                  return (
                    <div key={exp.id} className="border-b last:border-b-0" style={{ borderColor: "var(--fiori-border)", background: rowBg }}>
                      {/* Mobile */}
                      <div className="sm:hidden flex items-center justify-between px-4 py-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold" style={{ color: "var(--fiori-text)" }}>
                            <a href={`/categoria/${encodeURIComponent(exp.category)}`}
                              className="underline underline-offset-2 hover:opacity-70 transition-opacity"
                              style={{ color: "var(--fiori-blue)" }}>{exp.category}</a>
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: "var(--fiori-text-muted)" }}>{formatDate(exp.date)}</p>
                          {exp.notes && <p className="text-xs mt-0.5 italic" style={{ color: "var(--fiori-text-muted)" }}>{exp.notes}</p>}
                        </div>
                        <div className="flex items-center gap-2 ml-3 shrink-0">
                          {exp.receipt_url && (
                            <a href={exp.receipt_url} target="_blank" rel="noreferrer"
                              className="text-xs font-semibold px-2.5 py-1.5 rounded border"
                              style={{ color: "var(--fiori-blue)", borderColor: "var(--fiori-blue)", background: "#eff6ff" }}>
                              📎
                            </a>
                          )}
                          <span className="text-sm font-bold" style={{ color: "var(--fiori-text)" }}>
                            {exp.method === "efectivo" ? "💵" : "🏦"} {formatCurrency(exp.amount)}
                          </span>
                          {canEdit && (
                            <button onClick={() => setEditExpense(exp)}
                              className="text-xs px-2 py-1.5 rounded border"
                              style={{ color: "var(--fiori-text-muted)", borderColor: "var(--fiori-border)" }}>
                              ✏️
                            </button>
                          )}
                        </div>
                      </div>
                      {/* Desktop */}
                      <div className="hidden sm:flex items-center px-5 py-3.5 gap-x-3">
                        <div className="flex-1 grid grid-cols-[2.5fr_1.2fr_1.3fr_1.3fr] gap-x-3 items-center min-w-0">
                          <div className="min-w-0">
                            <a href={`/categoria/${encodeURIComponent(exp.category)}`}
                              className="text-sm font-semibold hover:underline transition-colors truncate block"
                              style={{ color: "var(--fiori-blue)" }}>{exp.category}</a>
                            <p className="text-xs mt-0.5" style={{ color: "var(--fiori-text-muted)" }}>{formatDate(exp.date)}</p>
                          </div>
                          <span className="text-xs italic truncate" style={{ color: "var(--fiori-text-muted)" }}>
                            {exp.notes ?? ""}
                          </span>
                          <span className="text-sm text-right font-semibold rounded px-1"
                            style={{
                              color: exp.method === "efectivo" ? "var(--fiori-text)" : "var(--fiori-border)",
                              background: exp.method === "efectivo" ? "#f8fafc" : "transparent",
                            }}>
                            {exp.method === "efectivo" ? formatCurrency(exp.amount) : "—"}
                          </span>
                          <span className="text-sm text-right font-semibold rounded px-1"
                            style={{
                              color: exp.method !== "efectivo" ? "var(--fiori-error)" : "var(--fiori-border)",
                              background: exp.method !== "efectivo" ? "#fef2f2" : "transparent",
                            }}>
                            {exp.method !== "efectivo" ? formatCurrency(exp.amount) : "—"}
                          </span>
                        </div>
                        <div className="w-36 shrink-0 flex justify-end items-center gap-2">
                          {exp.receipt_url && (
                            <a href={exp.receipt_url} target="_blank" rel="noreferrer"
                              className="text-xs font-semibold px-2.5 py-1.5 rounded border"
                              style={{ color: "var(--fiori-blue)", borderColor: "var(--fiori-blue)", background: "#eff6ff" }}>
                              📎 Adjunto
                            </a>
                          )}
                          {canEdit && (
                            <button type="button" onClick={() => setEditExpense(exp)}
                              className="text-xs px-3 py-1.5 rounded border transition-colors hover:bg-[#f8fafc]"
                              style={{ color: "var(--fiori-text-muted)", borderColor: "var(--fiori-border)" }}>
                              Editar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {/* Totals */}
                <div className="hidden sm:flex items-center px-5 py-4 border-t-2 gap-x-3"
                  style={{ background: "var(--fiori-table-header)", borderColor: "var(--fiori-border)" }}>
                  <div className="flex-1 grid grid-cols-[2.5fr_1.2fr_1.3fr_1.3fr] gap-x-3 items-center">
                    <span className="text-sm font-bold" style={{ color: "var(--fiori-text)" }}>Total</span>
                    <span />
                    <span className="text-sm text-right font-bold rounded px-1"
                      style={{ color: cashExpenses > 0 ? "var(--fiori-text)" : "var(--fiori-border)", background: cashExpenses > 0 ? "#f8fafc" : "transparent" }}>
                      {cashExpenses > 0 ? formatCurrency(cashExpenses) : "—"}
                    </span>
                    <span className="text-sm text-right font-bold rounded px-1"
                      style={{ color: transferExpenses > 0 ? "var(--fiori-error)" : "var(--fiori-border)", background: transferExpenses > 0 ? "#fef2f2" : "transparent" }}>
                      {transferExpenses > 0 ? formatCurrency(transferExpenses) : "—"}
                    </span>
                  </div>
                  <div className="w-36 shrink-0" />
                </div>
                {/* Mobile totals */}
                <div className="sm:hidden flex justify-between px-5 py-4 border-t-2"
                  style={{ background: "var(--fiori-table-header)", borderColor: "var(--fiori-border)" }}>
                  <span className="text-sm font-bold" style={{ color: "var(--fiori-text)" }}>Total</span>
                  <div className="text-right">
                    {cashExpenses > 0 && <div className="text-sm font-bold" style={{ color: "var(--fiori-text)" }}>{formatCurrency(cashExpenses)}</div>}
                    {transferExpenses > 0 && <div className="text-sm font-bold" style={{ color: "var(--fiori-error)" }}>{formatCurrency(transferExpenses)}</div>}
                  </div>
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
            <span className="w-1 h-5 rounded-full" style={{ background: "var(--fiori-success)" }} />
            <h2 className="text-base font-bold" style={{ color: "var(--fiori-text)" }}>Balance</h2>
            <span className="text-sm font-medium" style={{ color: "var(--fiori-text-muted)" }}>{formatMonthLabel(month)}</span>
          </div>

          <div className="rounded overflow-hidden border" style={{ borderColor: "var(--fiori-border)", background: "#fff" }}>
            {/* Column header */}
            <div className="grid grid-cols-[3fr_1.5fr_1.5fr_1.5fr] gap-x-3 px-5 py-2.5 border-b"
              style={{ background: "var(--fiori-table-header)", borderColor: "var(--fiori-border)" }}>
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--fiori-text-muted)" }} />
              <span className="text-xs font-bold uppercase tracking-widest text-right" style={{ color: "var(--fiori-success)" }}>💵 Caja</span>
              <span className="text-xs font-bold uppercase tracking-widest text-right" style={{ color: "var(--fiori-blue)" }}>🏦 Uala</span>
              <span className="text-xs font-bold uppercase tracking-widest text-right" style={{ color: "var(--fiori-text-muted)" }}>Total</span>
            </div>

            <BalanceRow label="Saldo apertura" cash={cashOpening} bank={bankOpening} />
            <BalanceRow label="+ Ingresos expensas" cash={cashIn} bank={transferIn} cashVariant="success" bankVariant="success" totalVariant="success" />
            <InteresesBalanceRow
              bankInterest={bankInterest}
              canEdit={canEdit}
              month={month}
              onSaved={(v) => { setBankInterestState(v); router.refresh(); }}
            />
            <BalanceRow label="− Egresos" cash={cashExpenses} bank={transferExpenses} cashVariant="error" bankVariant="error" totalVariant="error" />

            {/* Closing row */}
            <div className="grid grid-cols-[3fr_1.5fr_1.5fr_1.5fr] gap-x-3 px-5 py-4 border-t-2"
              style={{ background: "#f0fdf4", borderColor: "var(--fiori-success)" }}>
              <div>
                <span className="text-sm font-bold" style={{ color: "var(--fiori-text)" }}>= Saldo {closingDateLabel}</span>
                {isClosed && (
                  <p className="text-xs mt-0.5" style={{ color: "var(--fiori-success)" }}>
                    → Apertura {nextMonthLabel}
                  </p>
                )}
              </div>
              <span className="text-sm text-right font-bold" style={{ color: "var(--fiori-text)" }}>{formatCurrency(cashClosing)}</span>
              <span className="text-sm text-right font-bold" style={{ color: "var(--fiori-text)" }}>{formatCurrency(bankClosing)}</span>
              <span className="text-sm text-right font-bold" style={{ color: "var(--fiori-success)" }}>
                {formatCurrency(cashClosing + bankClosing)}
              </span>
            </div>
          </div>
        </section>

        <div className="h-4" />
      </div>

      {/* ── Modals ─────────────────────────────────────────── */}
      {canEdit && (
        <>
          <Modal open={paymentOpen} onClose={() => { setPaymentOpen(false); setPayingUnit(null); }} title={payingUnit ? `Registrar pago — ${payingUnit.name} · ${payingUnit.owner_name}` : "Registrar pago"}>
            <PaymentForm
              units={units.map(u => ({ id: u.id, name: u.name, owner_name: u.owner_name }))}
              defaultUnitId={payingUnit?.id}
              onSuccess={onPaymentSuccess}
              onCancel={() => { setPaymentOpen(false); setPayingUnit(null); }}
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
          <Modal open={!!editExpense} onClose={() => setEditExpense(null)} title="Editar gasto">
            {editExpense && (
              <EditExpenseForm
                expense={editExpense}
                categories={categories}
                onSuccess={onEditExpenseSuccess}
                onCancel={() => setEditExpense(null)}
              />
            )}
          </Modal>
        </>
      )}
    </div>
  );
}

// ── Balance Row ───────────────────────────────────────────────────────────────

type ColorVariant = "success" | "error" | "blue" | "default";

const variantColor: Record<ColorVariant, string> = {
  success: "var(--fiori-success)",
  error:   "var(--fiori-error)",
  blue:    "var(--fiori-blue)",
  default: "var(--fiori-text-muted)",
};

function BalanceRow({
  label, cash, bank,
  cashVariant = "default",
  bankVariant = "default",
  totalVariant = "default",
}: {
  label: string; cash: number | null; bank: number;
  cashVariant?: ColorVariant; bankVariant?: ColorVariant; totalVariant?: ColorVariant;
}) {
  const total = (cash ?? 0) + bank;
  return (
    <div className="grid grid-cols-[3fr_1.5fr_1.5fr_1.5fr] gap-x-3 px-5 py-3.5 border-b"
      style={{ borderColor: "var(--fiori-border)", background: "#fff" }}>
      <span className="text-sm font-medium" style={{ color: "var(--fiori-text)" }}>{label}</span>
      <span className="text-sm text-right font-semibold" style={{ color: variantColor[cashVariant] }}>
        {cash === null ? <span style={{ color: "var(--fiori-border)" }}>—</span> : formatCurrency(cash)}
      </span>
      <span className="text-sm text-right font-semibold" style={{ color: variantColor[bankVariant] }}>{formatCurrency(bank)}</span>
      <span className="text-sm text-right font-semibold" style={{ color: variantColor[totalVariant] }}>{formatCurrency(total)}</span>
    </div>
  );
}

// ── Intereses Balance Row ────────────────────────────────────────────────────

function InteresesBalanceRow({
  bankInterest, canEdit, month, onSaved,
}: {
  bankInterest: number;
  canEdit: boolean;
  month: string;
  onSaved: (v: number) => void;
}) {
  const supabase = createClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(bankInterest));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(value);
    if (isNaN(amount)) { setError("Monto inválido"); return; }
    setLoading(true);
    const { error: err } = await supabase
      .from("account_balances")
      .update({ bank_interest: amount })
      .eq("month", month);
    if (err) { setError(err.message); setLoading(false); return; }
    setEditing(false);
    setLoading(false);
    onSaved(amount);
  }

  if (editing) {
    return (
      <form onSubmit={handleSave}
        className="grid grid-cols-[3fr_1.5fr_1.5fr_1.5fr] gap-x-3 px-5 py-2.5 border-b items-center"
        style={{ borderColor: "var(--fiori-border)", background: "#f0f7ff" }}>
        <span className="text-sm font-medium" style={{ color: "var(--fiori-blue)" }}>+ Intereses Uala</span>
        <span />
        <input
          type="number" min="0" step="0.01" autoFocus
          value={value} onChange={e => setValue(e.target.value)}
          className="text-sm text-right border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#3b82f6] w-full"
          style={{ borderColor: "var(--fiori-border)", color: "var(--fiori-text)" }}
        />
        <div className="flex gap-1.5 justify-end">
          <button type="button" onClick={() => { setEditing(false); setError(""); }}
            className="text-xs px-2 py-1 border rounded"
            style={{ borderColor: "var(--fiori-border)", color: "var(--fiori-text-muted)" }}>
            ✕
          </button>
          <button type="submit" disabled={loading}
            className="text-xs px-2 py-1 text-white rounded disabled:opacity-50"
            style={{ background: "var(--fiori-blue)" }}>
            {loading ? "…" : "✓"}
          </button>
        </div>
        {error && <span className="col-span-4 text-xs" style={{ color: "var(--fiori-error)" }}>{error}</span>}
      </form>
    );
  }

  if (bankInterest <= 0 && !canEdit) return null;

  return (
    <div className="grid grid-cols-[3fr_1.5fr_1.5fr_1.5fr] gap-x-3 px-5 py-3.5 border-b items-center"
      style={{ borderColor: "var(--fiori-border)", background: "#fff" }}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium" style={{ color: bankInterest > 0 ? "var(--fiori-blue)" : "var(--fiori-text-muted)" }}>
          + Intereses Uala
        </span>
        {canEdit && (
          <button onClick={() => { setValue(String(bankInterest)); setEditing(true); }}
            className="text-xs px-2 py-0.5 rounded border transition-colors"
            style={{ color: "var(--fiori-blue)", borderColor: "var(--fiori-blue)", background: "#eff6ff" }}>
            {bankInterest > 0 ? "Editar" : "+ Agregar"}
          </button>
        )}
      </div>
      <span style={{ color: "var(--fiori-border)" }} className="text-sm text-right">—</span>
      <span className="text-sm text-right font-semibold"
        style={{ color: bankInterest > 0 ? "var(--fiori-blue)" : "var(--fiori-border)" }}>
        {bankInterest > 0 ? formatCurrency(bankInterest) : "—"}
      </span>
      <span className="text-sm text-right font-semibold"
        style={{ color: bankInterest > 0 ? "var(--fiori-blue)" : "var(--fiori-border)" }}>
        {bankInterest > 0 ? formatCurrency(bankInterest) : "—"}
      </span>
    </div>
  );
}

// ── Edit Payment Form ─────────────────────────────────────────────────────────

function buildMonthOptions(): string[] {
  const options: string[] = [];
  const start = new Date(2025, 11, 1); // December 2025
  const end = new Date(2026, 11, 1);   // December 2026
  for (let d = new Date(end); d >= start; d.setMonth(d.getMonth() - 1)) {
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!HIDDEN_MONTHS.has(m)) options.push(m);
  }
  return options;
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
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set([payment.month]));
  const [notes, setNotes] = useState(payment.notes ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function toggleMonth(m: string) {
    setSelectedMonths(prev => {
      const next = new Set(prev);
      if (next.has(m)) { if (next.size > 1) next.delete(m); }
      else next.add(m);
      return next;
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!amount || selectedMonths.size === 0) { setError("Completá todos los campos."); return; }
    setLoading(true);
    const amt = parseFloat(amount);
    const months = Array.from(selectedMonths).sort();

    if (selectedMonths.size === 1) {
      // Simple update — keep existing row
      const { error: err } = await supabase
        .from("payments")
        .update({ amount: amt, method, date, month: months[0], notes: notes || null })
        .eq("id", payment.id);
      if (err) { setError("Error al guardar: " + err.message); setLoading(false); return; }
    } else {
      // Multiple months: delete original + insert one row per month
      const { error: delErr } = await supabase.from("payments").delete().eq("id", payment.id);
      if (delErr) { setError("Error al actualizar: " + delErr.message); setLoading(false); return; }
      const rows = months.map(m => ({
        unit_id: payment.unit_id,
        amount: amt,
        method,
        month: m,
        date,
        notes: notes || null,
        receipt_url: payment.receipt_url ?? null,
      }));
      const { error: insErr } = await supabase.from("payments").insert(rows);
      if (insErr) { setError("Error al insertar: " + insErr.message); setLoading(false); return; }
    }
    onSuccess();
    setLoading(false);
  }

  async function handleDelete() {
    setLoading(true);
    const { error: err } = await supabase.from("payments").delete().eq("id", payment.id);
    if (err) { setError("Error al eliminar: " + err.message); setLoading(false); }
    else onSuccess();
  }

  const totalAmount = parseFloat(amount || "0") * selectedMonths.size;

  if (confirmDelete) {
    return (
      <div className="space-y-4">
        <p className="text-sm" style={{ color: "var(--fiori-text)" }}>
          ¿Eliminar pago de <strong>{formatCurrency(payment.amount)}</strong> ({payment.method}) del {formatDate(payment.date)}?
        </p>
        {error && <p className="text-sm bg-[#fef2f2] px-3 py-2 rounded" style={{ color: "var(--fiori-error)" }}>{error}</p>}
        <div className="flex gap-2 justify-end">
          <button onClick={() => setConfirmDelete(false)}
            className="px-3 py-2 text-sm border rounded"
            style={{ borderColor: "var(--fiori-border)", color: "var(--fiori-text-muted)" }}>
            Cancelar
          </button>
          <button onClick={handleDelete} disabled={loading}
            className="px-3 py-2 text-sm text-white rounded disabled:opacity-50"
            style={{ background: "var(--fiori-error)" }}>
            {loading ? "Eliminando…" : "Sí, eliminar"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--fiori-text)" }}>Monto por mes *</label>
        <input type="number" required min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
          className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
          style={{ borderColor: "var(--fiori-border)", color: "var(--fiori-text)" }} />
        {selectedMonths.size > 1 && amount && (
          <p className="text-xs mt-1" style={{ color: "var(--fiori-blue)" }}>
            {selectedMonths.size} meses × {formatCurrency(parseFloat(amount))} = <strong>{formatCurrency(totalAmount)}</strong> total
          </p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--fiori-text)" }}>Período que cubre *</label>
        <p className="text-xs mb-2" style={{ color: "var(--fiori-text-muted)" }}>
          Seleccioná uno o más meses que salda este pago.
        </p>
        <div className="border rounded overflow-hidden max-h-48 overflow-y-auto" style={{ borderColor: "var(--fiori-border)" }}>
          {buildMonthOptions().map((m, idx) => {
            const checked = selectedMonths.has(m);
            return (
              <label key={m}
                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors border-b last:border-b-0 ${
                  checked ? "bg-[#eff6ff]" : idx % 2 === 0 ? "bg-white" : "bg-[#f8fafc]"
                } hover:bg-[#eff6ff]`}
                style={{ borderColor: "var(--fiori-border)" }}>
                <input type="checkbox" checked={checked} onChange={() => toggleMonth(m)}
                  className="w-4 h-4 rounded accent-[#3b82f6]" />
                <span className="text-sm" style={{ color: checked ? "var(--fiori-blue)" : "var(--fiori-text)", fontWeight: checked ? 600 : 400 }}>
                  {formatMonthLabel(m)}
                </span>
              </label>
            );
          })}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: "var(--fiori-text)" }}>Método</label>
        <div className="flex gap-3">
          {(["efectivo", "transferencia"] as const).map(m => (
            <label key={m} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded border-2 cursor-pointer transition-colors ${
              method === m ? "border-[#3b82f6] bg-[#eff6ff]" : "border-[#e5e5e5] hover:border-[#c0c0c0]"
            }`} style={{ color: method === m ? "var(--fiori-blue)" : "var(--fiori-text-muted)" }}>
              <input type="radio" name="editMethod" value={m} checked={method === m} onChange={() => setMethod(m)} className="sr-only" />
              <span>{m === "efectivo" ? "💵 Efectivo" : "🏦 Transferencia"}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--fiori-text)" }}>Fecha</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
            style={{ borderColor: "var(--fiori-border)", color: "var(--fiori-text)" }} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--fiori-text)" }}>Notas</label>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opcional"
            className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
            style={{ borderColor: "var(--fiori-border)", color: "var(--fiori-text)" }} />
        </div>
      </div>
      {error && <p className="text-sm bg-[#fef2f2] px-3 py-2 rounded" style={{ color: "var(--fiori-error)" }}>{error}</p>}
      <div className="flex items-center justify-between pt-1">
        <button type="button" onClick={() => setConfirmDelete(true)}
          className="text-sm px-2 py-1 rounded transition-colors hover:bg-[#fef2f2]"
          style={{ color: "var(--fiori-error)" }}>
          Eliminar pago
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel}
            className="px-3 py-2 text-sm border rounded"
            style={{ borderColor: "var(--fiori-border)", color: "var(--fiori-text-muted)" }}>
            Cancelar
          </button>
          <button type="submit" disabled={loading}
            className="px-4 py-2 text-sm text-white rounded disabled:opacity-50"
            style={{ background: "var(--fiori-blue)" }}>
            {loading ? "Guardando…" : selectedMonths.size > 1 ? `Guardar (${selectedMonths.size} meses)` : "Guardar"}
          </button>
        </div>
      </div>
    </form>
  );
}

// ── Edit Expense Form ────────────────────────────────────────────────────────

function EditExpenseForm({
  expense, categories, onSuccess, onCancel,
}: {
  expense: Expense;
  categories: { id: string; name: string }[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const supabase = createClient();
  const [amount, setAmount]           = useState(String(expense.amount));
  const [method, setMethod]           = useState<"efectivo" | "transferencia">(
    expense.method === "efectivo" ? "efectivo" : "transferencia"
  );
  const [category, setCategory]       = useState(expense.category);
  const [date, setDate]               = useState(expense.date);
  const [notes, setNotes]             = useState(expense.notes ?? "");
  // Receipt handling: keep existing, remove it, or replace with new file
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [removeReceipt, setRemoveReceipt] = useState(false);
  const [error, setError]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [confirming, setConfirming]   = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Effective receipt state after edits
  const effectiveReceiptUrl = removeReceipt ? null : (receiptFile ? URL.createObjectURL(receiptFile) : expense.receipt_url ?? null);
  const hasReceipt = !!receiptFile || (!removeReceipt && !!expense.receipt_url);

  // Detect which fields changed
  const changes: { field: string; from: string; to: string }[] = [];
  if (parseFloat(amount) !== expense.amount)
    changes.push({ field: "Monto", from: formatCurrency(expense.amount), to: formatCurrency(parseFloat(amount || "0")) });
  if (method !== expense.method)
    changes.push({ field: "Método", from: expense.method === "efectivo" ? "💵 Efectivo" : "🏦 Transferencia", to: method === "efectivo" ? "💵 Efectivo" : "🏦 Transferencia" });
  if (category !== expense.category)
    changes.push({ field: "Categoría", from: expense.category, to: category });
  if (date !== expense.date)
    changes.push({ field: "Fecha", from: formatDate(expense.date), to: formatDate(date) });
  if (notes !== (expense.notes ?? ""))
    changes.push({ field: "Notas", from: expense.notes || "—", to: notes || "—" });
  if (receiptFile)
    changes.push({ field: "Adjunto", from: expense.receipt_url ? "Con adjunto" : "Sin adjunto", to: `📎 ${receiptFile.name}` });
  if (removeReceipt && expense.receipt_url)
    changes.push({ field: "Adjunto", from: "Con adjunto", to: "Eliminado" });

  // Warning: transferencia without attachment
  const noReceiptWarning = method === "transferencia" && !hasReceipt;

  function handleReview(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!amount || !category) { setError("Completá todos los campos."); return; }
    if (changes.length === 0 && !noReceiptWarning) { onCancel(); return; }
    setConfirming(true);
  }

  async function handleConfirm() {
    setError("");
    setLoading(true);

    let receipt_url: string | null | undefined = undefined; // undefined = don't change

    if (removeReceipt) {
      receipt_url = null;
    } else if (receiptFile) {
      const ext = receiptFile.name.split(".").pop() ?? "pdf";
      const filename = `expense-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("receipts").upload(filename, receiptFile);
      if (uploadErr) { setError("Error al subir el adjunto: " + uploadErr.message); setLoading(false); setConfirming(false); return; }
      const { data: { publicUrl } } = supabase.storage.from("receipts").getPublicUrl(filename);
      receipt_url = publicUrl;
    }

    const updatePayload: Record<string, unknown> = { amount: parseFloat(amount), method, category, date, notes: notes.trim() || null };
    if (receipt_url !== undefined) updatePayload.receipt_url = receipt_url;

    const { error: err } = await supabase.from("expenses").update(updatePayload).eq("id", expense.id);
    if (err) { setError("Error al guardar: " + err.message); setLoading(false); setConfirming(false); return; }
    onSuccess();
    setLoading(false);
  }

  async function handleDelete() {
    setLoading(true);
    const { error: err } = await supabase.from("expenses").delete().eq("id", expense.id);
    if (err) { setError("Error al eliminar: " + err.message); setLoading(false); }
    else onSuccess();
  }

  // ── Confirm delete ──
  if (confirmDelete) {
    return (
      <div className="space-y-4">
        <p className="text-sm" style={{ color: "var(--fiori-text)" }}>
          ¿Eliminar <strong>{expense.category}</strong> ({formatCurrency(expense.amount)}) del {formatDate(expense.date)}?
        </p>
        {error && <p className="text-sm bg-[#fef2f2] px-3 py-2 rounded" style={{ color: "var(--fiori-error)" }}>{error}</p>}
        <div className="flex gap-2 justify-end">
          <button onClick={() => setConfirmDelete(false)}
            className="px-3 py-2 text-sm border rounded"
            style={{ borderColor: "var(--fiori-border)", color: "var(--fiori-text-muted)" }}>
            Cancelar
          </button>
          <button onClick={handleDelete} disabled={loading}
            className="px-3 py-2 text-sm text-white rounded disabled:opacity-50"
            style={{ background: "var(--fiori-error)" }}>
            {loading ? "Eliminando…" : "Sí, eliminar"}
          </button>
        </div>
      </div>
    );
  }

  // ── Confirm changes ──
  if (confirming) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">⚠️</span>
          <p className="text-sm font-semibold" style={{ color: "var(--fiori-text)" }}>
            Revisá los cambios antes de guardar
          </p>
        </div>

        {/* No-receipt warning for transferencia */}
        {noReceiptWarning && (
          <div className="flex items-start gap-2 px-3 py-3 rounded border"
            style={{ background: "#fff8ec", borderColor: "var(--fiori-warning)" }}>
            <span className="text-base mt-0.5">⚠️</span>
            <p className="text-sm" style={{ color: "var(--fiori-warning)" }}>
              Este gasto es por <strong>transferencia</strong> pero no tiene comprobante adjunto. ¿Estás seguro que querés guardar sin adjunto?
            </p>
          </div>
        )}

        {changes.length > 0 && (
          <div className="rounded border overflow-hidden" style={{ borderColor: "var(--fiori-border)" }}>
            <div className="px-4 py-2 border-b text-xs font-bold uppercase tracking-widest"
              style={{ background: "var(--fiori-table-header)", borderColor: "var(--fiori-border)", color: "var(--fiori-text-muted)" }}>
              Modificaciones
            </div>
            {changes.map(c => (
              <div key={c.field} className="grid grid-cols-[1.2fr_2fr_2fr] gap-x-3 px-4 py-3 border-b last:border-b-0 items-start"
                style={{ borderColor: "var(--fiori-border)" }}>
                <span className="text-xs font-semibold" style={{ color: "var(--fiori-text-muted)" }}>{c.field}</span>
                <span className="text-xs line-through" style={{ color: "var(--fiori-error)" }}>{c.from}</span>
                <span className="text-xs font-semibold" style={{ color: "var(--fiori-success)" }}>{c.to}</span>
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-sm bg-[#fef2f2] px-3 py-2 rounded" style={{ color: "var(--fiori-error)" }}>{error}</p>}
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={() => setConfirming(false)}
            className="px-3 py-2 text-sm border rounded"
            style={{ borderColor: "var(--fiori-border)", color: "var(--fiori-text-muted)" }}>
            ← Corregir
          </button>
          <button type="button" onClick={handleConfirm} disabled={loading}
            className="px-4 py-2 text-sm text-white rounded disabled:opacity-50"
            style={{ background: noReceiptWarning ? "var(--fiori-warning)" : "var(--fiori-blue)" }}>
            {loading ? "Guardando…" : noReceiptWarning ? "Guardar sin adjunto" : "Confirmar cambios"}
          </button>
        </div>
      </div>
    );
  }

  // ── Form ──
  return (
    <form onSubmit={handleReview} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--fiori-text)" }}>Monto *</label>
          <input type="number" required min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
            className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
            style={{ borderColor: "var(--fiori-border)", color: "var(--fiori-text)" }} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--fiori-text)" }}>Fecha *</label>
          <input type="date" required value={date} onChange={e => setDate(e.target.value)}
            className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
            style={{ borderColor: "var(--fiori-border)", color: "var(--fiori-text)" }} />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--fiori-text)" }}>Categoría *</label>
        <select required value={category} onChange={e => setCategory(e.target.value)}
          className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
          style={{ borderColor: "var(--fiori-border)", color: "var(--fiori-text)" }}>
          <option value="">Seleccioná una categoría</option>
          {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          {!categories.find(c => c.name === category) && category && (
            <option value={category}>{category}</option>
          )}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: "var(--fiori-text)" }}>Método</label>
        <div className="flex gap-3">
          {(["efectivo", "transferencia"] as const).map(m => (
            <label key={m} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded border-2 cursor-pointer transition-colors ${
              method === m ? "border-[#3b82f6] bg-[#eff6ff]" : "border-[#e5e5e5] hover:border-[#c0c0c0]"
            }`} style={{ color: method === m ? "var(--fiori-blue)" : "var(--fiori-text-muted)" }}>
              <input type="radio" name="editExpMethod" value={m} checked={method === m} onChange={() => setMethod(m)} className="sr-only" />
              <span>{m === "efectivo" ? "💵 Efectivo" : "🏦 Transferencia"}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--fiori-text)" }}>Notas <span className="font-normal" style={{ color: "var(--fiori-text-muted)" }}>(opcional)</span></label>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ej: Factura 0001-00123456, pago parcial, etc."
          className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
          style={{ borderColor: "var(--fiori-border)", color: "var(--fiori-text)" }} />
      </div>

      {/* Receipt management */}      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: "var(--fiori-text)" }}>Comprobante</label>
        {expense.receipt_url && !removeReceipt && !receiptFile && (
          <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded border"
            style={{ borderColor: "var(--fiori-border)", background: "#f9f9f9" }}>
            <span className="text-sm flex-1" style={{ color: "var(--fiori-blue)" }}>📎 Adjunto actual</span>
            <a href={expense.receipt_url} target="_blank" rel="noreferrer"
              className="text-xs px-2 py-1 rounded border"
              style={{ color: "var(--fiori-blue)", borderColor: "var(--fiori-blue)" }}>
              Ver
            </a>
            <button type="button" onClick={() => setRemoveReceipt(true)}
              className="text-xs px-2 py-1 rounded border"
              style={{ color: "var(--fiori-error)", borderColor: "var(--fiori-error)" }}>
              Eliminar
            </button>
          </div>
        )}
        {removeReceipt && (
          <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded border"
            style={{ borderColor: "var(--fiori-warning)", background: "#fff8ec" }}>
            <span className="text-sm flex-1" style={{ color: "var(--fiori-warning)" }}>Se eliminará el adjunto actual</span>
            <button type="button" onClick={() => setRemoveReceipt(false)}
              className="text-xs px-2 py-1 rounded border"
              style={{ color: "var(--fiori-text-muted)", borderColor: "var(--fiori-border)" }}>
              Deshacer
            </button>
          </div>
        )}
        {receiptFile ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded border"
            style={{ borderColor: "var(--fiori-success)", background: "#f0fdf4" }}>
            <span className="text-sm flex-1 truncate" style={{ color: "var(--fiori-success)" }}>📎 {receiptFile.name}</span>
            <button type="button" onClick={() => setReceiptFile(null)}
              className="text-xs px-2 py-1 rounded border shrink-0"
              style={{ color: "var(--fiori-text-muted)", borderColor: "var(--fiori-border)" }}>
              Quitar
            </button>
          </div>
        ) : (
          <input type="file" accept="image/*,.pdf"
            onChange={e => { setReceiptFile(e.target.files?.[0] ?? null); setRemoveReceipt(false); }}
            className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-[#eff6ff] file:text-[#3b82f6] hover:file:bg-[#d0e8ff]" />
        )}
      </div>

      {error && <p className="text-sm bg-[#fef2f2] px-3 py-2 rounded" style={{ color: "var(--fiori-error)" }}>{error}</p>}
      <div className="flex items-center justify-between pt-1">
        <button type="button" onClick={() => setConfirmDelete(true)}
          className="text-sm px-2 py-1 rounded transition-colors hover:bg-[#fef2f2]"
          style={{ color: "var(--fiori-error)" }}>
          Eliminar gasto
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel}
            className="px-3 py-2 text-sm border rounded"
            style={{ borderColor: "var(--fiori-border)", color: "var(--fiori-text-muted)" }}>
            Cancelar
          </button>
          <button type="submit" disabled={loading}
            className="px-4 py-2 text-sm text-white rounded disabled:opacity-50"
            style={{ background: "var(--fiori-blue)" }}>
            Revisar →
          </button>
        </div>
      </div>
    </form>
  );
}

// ── Close Month Panel ─────────────────────────────────────────────────────────

function CloseMonthPanel({
  month, accountBalance, feeAmount, units,
  openingByUnit, cashByUnit, transferByUnit, bankInterest,
  cashClosing, bankClosing,
}: {
  month: string;
  accountBalance: AccountBalance | null;
  feeAmount: number;
  units: Unit[];
  openingByUnit: Record<string, number>;
  cashByUnit: Record<string, number>;
  transferByUnit: Record<string, number>;
  bankInterest: number;
  cashClosing: number;
  bankClosing: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const hasOpeningBalance = accountBalance !== null;
  const hasFee = feeAmount > 0;
  const pendingCount = units.filter(u => {
    const ant = openingByUnit[u.id] ?? 0;
    const paid = (cashByUnit[u.id] ?? 0) + (transferByUnit[u.id] ?? 0);
    return ant + feeAmount - paid > 0;
  }).length;

  const blockers = [
    !hasOpeningBalance && "Saldo apertura no configurado",
    !hasFee && "Expensa del mes no configurada",
  ].filter(Boolean) as string[];

  const warnings = [
    bankInterest === 0 && "Intereses Uala en $0 — ¿confirmás que no hubo intereses?",
    pendingCount > 0 && `${pendingCount} unidad${pendingCount !== 1 ? "es" : ""} con saldo pendiente`,
  ].filter(Boolean) as string[];

  const canClose = blockers.length === 0;

  function nextMonthLabel() {
    const [y, m] = month.split("-").map(Number);
    const nm = m === 12 ? 1 : m + 1;
    const ny = m === 12 ? y + 1 : y;
    return formatMonthLabel(`${ny}-${String(nm).padStart(2, "0")}`);
  }

  async function handleClose() {
    setStatus("loading");
    setErrorMsg("");
    try {
      const closeRes = await fetch("/api/months/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceMonth: month }),
      });
      if (!closeRes.ok) {
        const { error: e } = await closeRes.json().catch(() => ({ error: "Error al cerrar el mes" }));
        throw new Error(e ?? "Error al cerrar el mes");
      }
      const reportRes = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month }),
      });
      if (!reportRes.ok) {
        const { error: e } = await reportRes.json().catch(() => ({ error: "Error al generar el reporte" }));
        throw new Error(e ?? "Error al generar el reporte");
      }
      setStatus("done");
      setTimeout(() => router.refresh(), 1200);
    } catch (e: any) {
      setErrorMsg(e.message ?? "Error desconocido");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="border rounded px-4 py-3 flex items-center gap-3"
        style={{ background: "#f0fdf4", borderColor: "var(--fiori-success)" }}>
        <span className="text-lg" style={{ color: "var(--fiori-success)" }}>✓</span>
        <p className="text-sm font-semibold" style={{ color: "var(--fiori-success)" }}>
          {formatMonthLabel(month)} cerrado · Reporte generado y publicado en Documentos
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="flex justify-end">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 text-white text-sm font-bold px-4 py-2 rounded transition-colors"
          style={{ background: "var(--fiori-success)" }}
        >
          🔒 Cerrar {formatMonthLabel(month)}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded border overflow-hidden" style={{ borderColor: "var(--fiori-border)", background: "#fff" }}>
      <div className="px-5 py-4 border-b flex items-center justify-between"
        style={{ background: "#f0fdf4", borderColor: "var(--fiori-success)" }}>
        <div className="flex items-center gap-2">
          <span className="text-lg">🔒</span>
          <h3 className="text-base font-bold" style={{ color: "var(--fiori-text)" }}>Cerrar {formatMonthLabel(month)}</h3>
        </div>
        <button onClick={() => { setOpen(false); setConfirming(false); }}
          className="text-sm px-2" style={{ color: "var(--fiori-text-muted)" }}>✕</button>
      </div>

      <div className="px-5 py-4 space-y-3">
        {blockers.map(b => (
          <div key={b} className="flex items-start gap-2 text-sm" style={{ color: "var(--fiori-error)" }}>
            <span className="mt-0.5 shrink-0">❌</span><span>{b}</span>
          </div>
        ))}
        {hasOpeningBalance && (
          <div className="flex items-start gap-2 text-sm" style={{ color: "var(--fiori-success)" }}>
            <span className="mt-0.5 shrink-0">✅</span>
            <span>Saldo apertura configurado</span>
          </div>
        )}
        {hasFee && (
          <div className="flex items-start gap-2 text-sm" style={{ color: "var(--fiori-success)" }}>
            <span className="mt-0.5 shrink-0">✅</span>
            <span>Expensa configurada — {formatCurrency(feeAmount)}</span>
          </div>
        )}
        {warnings.map(w => (
          <div key={w} className="flex items-start gap-2 text-sm" style={{ color: "var(--fiori-warning)" }}>
            <span className="mt-0.5 shrink-0">⚠️</span><span>{w}</span>
          </div>
        ))}
        {canClose && (
          <div className="mt-1 rounded border divide-y" style={{ borderColor: "var(--fiori-border)" }}>
            <div className="flex justify-between px-4 py-2.5 text-sm">
              <span style={{ color: "var(--fiori-text-muted)" }}>Saldo cierre 💵 Caja</span>
              <span className="font-semibold" style={{ color: "var(--fiori-text)" }}>{formatCurrency(cashClosing)}</span>
            </div>
            <div className="flex justify-between px-4 py-2.5 text-sm">
              <span style={{ color: "var(--fiori-text-muted)" }}>Saldo cierre 🏦 Uala</span>
              <span className="font-semibold" style={{ color: "var(--fiori-text)" }}>{formatCurrency(bankClosing)}</span>
            </div>
            <div className="flex justify-between px-4 py-2.5 text-sm rounded-b"
              style={{ background: "#f0fdf4" }}>
              <span className="font-semibold" style={{ color: "var(--fiori-success)" }}>Total a trasladar</span>
              <span className="font-bold" style={{ color: "var(--fiori-success)" }}>{formatCurrency(cashClosing + bankClosing)}</span>
            </div>
          </div>
        )}
        {status === "error" && (
          <p className="text-xs px-3 py-2 rounded" style={{ color: "var(--fiori-error)", background: "#fef2f2" }}>{errorMsg}</p>
        )}
        <div className="flex gap-3 pt-1">
          <button
            onClick={() => { setOpen(false); setConfirming(false); }}
            className="flex-1 px-4 py-2.5 text-sm font-semibold border rounded transition-colors"
            style={{ borderColor: "var(--fiori-border)", color: "var(--fiori-text-muted)" }}
          >
            Cancelar
          </button>
          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
              disabled={!canClose}
              className="flex-1 px-4 py-2.5 text-sm font-bold text-white rounded transition-colors disabled:opacity-40"
              style={{ background: "var(--fiori-success)" }}
            >
              Continuar →
            </button>
          ) : (
            <button
              onClick={handleClose}
              disabled={status === "loading"}
              className="flex-1 px-4 py-2.5 text-sm font-bold text-white rounded transition-colors disabled:opacity-50"
              style={{ background: "var(--fiori-success)" }}
            >
              {status === "loading" ? "Cerrando…" : "✓ Confirmar cierre"}
            </button>
          )}
        </div>
        {confirming && status !== "loading" && (
          <p className="text-xs text-center" style={{ color: "var(--fiori-warning)" }}>
            Esta acción es irreversible. El mes quedará en modo solo lectura y se abrirá {nextMonthLabel()}.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Set Fee Panel ──────────────────────────────────────────────────────────────

function SetFeePanel({ month, feeAmount, onSaved }: {
  month: string;
  feeAmount: number;
  onSaved: () => void;
}) {
  const [editing, setEditing]   = useState(false);
  const [value, setValue]       = useState(feeAmount > 0 ? String(feeAmount) : "");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(value);
    if (isNaN(amount) || amount <= 0) { setError("Monto inválido."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/months/set-fee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, amount }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al guardar.");
      setEditing(false);
      onSaved();
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  }

  if (editing) {
    return (
      <form onSubmit={handleSave} className="border rounded px-4 py-3 space-y-2"
        style={{ borderColor: "var(--fiori-border)" }}>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium flex-1" style={{ color: "var(--fiori-text)" }}>
            Expensa — {formatMonthLabel(month)}
          </span>
          <input
            type="number" min="1" step="0.01" required autoFocus
            value={value} onChange={e => setValue(e.target.value)}
            placeholder="0.00"
            className="w-36 text-sm text-right border rounded px-2 py-1 focus:outline-none focus:ring-2"
            style={{ borderColor: "var(--fiori-border)", color: "var(--fiori-text)" }}
          />
          <button type="button" onClick={() => { setEditing(false); setError(""); }}
            className="text-xs px-2 py-1 border rounded"
            style={{ borderColor: "var(--fiori-border)", color: "var(--fiori-text-muted)" }}>
            ✕
          </button>
          <button type="submit" disabled={loading}
            className="text-xs px-3 py-1.5 font-semibold text-white rounded disabled:opacity-50"
            style={{ background: "var(--fiori-success)" }}>
            {loading ? "…" : "✓ Guardar"}
          </button>
        </div>
        {error && (
          <p className="text-xs px-3 py-2 rounded" style={{ color: "var(--fiori-error)", background: "#fef2f2" }}>
            {error}
          </p>
        )}
      </form>
    );
  }

  if (feeAmount > 0) {
    return (
      <div className="border rounded px-4 py-3 flex items-center gap-3"
        style={{ borderColor: "#86efac", background: "#f0fdf4" }}>
        <span style={{ color: "var(--fiori-success)" }}>✓</span>
        <span className="text-sm flex-1" style={{ color: "var(--fiori-success)" }}>
          Expensa configurada — <strong>{formatCurrency(feeAmount)}</strong>
        </span>
        <button
          onClick={() => { setValue(String(feeAmount)); setEditing(true); }}
          className="text-xs px-2 py-1 border rounded transition-colors"
          style={{ color: "var(--fiori-success)", borderColor: "#86efac", background: "#dcfce7" }}>
          Editar
        </button>
      </div>
    );
  }

  return (
    <div className="border rounded px-4 py-3 flex items-center gap-3"
      style={{ borderColor: "#fcd34d", background: "#fffbeb" }}>
      <span>⚠️</span>
      <span className="text-sm flex-1 font-medium" style={{ color: "#92400e" }}>
        Expensa de {formatMonthLabel(month)} no configurada
      </span>
      <button
        onClick={() => { setValue(""); setEditing(true); }}
        className="text-xs px-3 py-1.5 font-semibold text-white rounded transition-colors"
        style={{ background: "#d97706" }}>
        Configurar
      </button>
    </div>
  );
}
