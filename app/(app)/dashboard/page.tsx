import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  formatCurrency, currentMonth, formatMonthLabel, getPaymentStatus,
} from "@/lib/utils";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Link from "next/link";
import BalanceChart, { MonthBalance } from "./BalanceChart";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const month = currentMonth();

  if (!user) return <AdminDashboard month={month} />;

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, role, unit_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") return <AdminDashboard month={month} />;

  return <AdminDashboard month={month} />;
}

// ── Admin Dashboard ──────────────────────────────────────────────────────────

async function AdminDashboard({ month }: { month: string }) {
  const svc = createServiceClient();

  const [allBalancesRes, allPaymentsRes, allExpensesRes, feesRes, announcementsRes, monthPaymentsRes, unitsRes] = await Promise.all([
    svc.from("account_balances")
      .select("month, cash_opening, bank_opening, bank_interest")
      .order("month"),
    svc.from("payments").select("date, amount, method"),
    svc.from("expenses").select("date, amount, method"),
    svc.from("monthly_fees").select("amount").eq("month", month).single(),
    svc.from("announcements").select("title, content, date").order("date", { ascending: false }).limit(5),
    svc.from("payments").select("unit_id, amount").eq("month", month),
    svc.from("units").select("id"),
  ]);

  const allBalances = allBalancesRes.data ?? [];
  const allPayments = allPaymentsRes.data ?? [];
  const allExpenses = allExpensesRes.data ?? [];

  // ── Per-month closing balance (for chart) ───────────────
  const chartData: MonthBalance[] = allBalances.map((ab) => {
    const m = ab.month;
    const cashIn = allPayments
      .filter(p => p.date.startsWith(m) && p.method === "efectivo")
      .reduce((s, p) => s + Number(p.amount), 0);
    const transferIn = allPayments
      .filter(p => p.date.startsWith(m) && p.method === "transferencia")
      .reduce((s, p) => s + Number(p.amount), 0);
    const cashOut = allExpenses
      .filter(e => e.date.startsWith(m) && (e.method ?? "transferencia") === "efectivo")
      .reduce((s, e) => s + Number(e.amount), 0);
    const transferOut = allExpenses
      .filter(e => e.date.startsWith(m) && (e.method ?? "transferencia") !== "efectivo")
      .reduce((s, e) => s + Number(e.amount), 0);
    const ingresos = cashIn + transferIn;
    const egresos  = cashOut + transferOut;
    return {
      month: m,
      caja: Number(ab.cash_opening) + cashIn - cashOut,
      belo: Number(ab.bank_opening) + transferIn + Number((ab as any).bank_interest ?? 0) - transferOut,
      ingresos,
      egresos,
    };
  });

  // ── Current month balance ────────────────────────────────
  const currentAb = allBalances.find(ab => ab.month === month);
  const cashOpening  = Number(currentAb?.cash_opening ?? 0);
  const bankOpening  = Number(currentAb?.bank_opening ?? 0);
  const bankInterest = Number((currentAb as any)?.bank_interest ?? 0);

  const cashIn  = allPayments.filter(p => p.date.startsWith(month) && p.method === "efectivo").reduce((s, p) => s + Number(p.amount), 0);
  const bankIn  = allPayments.filter(p => p.date.startsWith(month) && p.method === "transferencia").reduce((s, p) => s + Number(p.amount), 0);
  const cashOut = allExpenses.filter(e => e.date.startsWith(month) && (e.method ?? "transferencia") === "efectivo").reduce((s, e) => s + Number(e.amount), 0);
  const bankOut = allExpenses.filter(e => e.date.startsWith(month) && (e.method ?? "transferencia") !== "efectivo").reduce((s, e) => s + Number(e.amount), 0);

  const cashBalance  = cashOpening + cashIn - cashOut;
  const bankBalance  = bankOpening + bankIn + bankInterest - bankOut;
  const totalBalance = cashBalance + bankBalance;
  const totalIn      = cashIn + bankIn;
  const totalOut     = cashOut + bankOut;

  const feeAmount = feesRes.data?.amount ?? 0;
  const announcements = announcementsRes.data ?? [];

  // ── Cobro del mes ────────────────────────────────────────
  const totalUnits = (unitsRes.data ?? []).length;
  const paidByUnit: Record<string, number> = {};
  for (const p of monthPaymentsRes.data ?? []) {
    paidByUnit[p.unit_id] = (paidByUnit[p.unit_id] ?? 0) + Number(p.amount);
  }
  const unitsPaid    = Object.values(paidByUnit).filter(v => feeAmount > 0 ? v >= feeAmount : v > 0).length;
  const unitsPartial = Object.values(paidByUnit).filter(v => feeAmount > 0 && v > 0 && v < feeAmount).length;
  const unitsPending = totalUnits - unitsPaid - unitsPartial;
  const pctPaid      = totalUnits > 0 ? (unitsPaid / totalUnits) * 100 : 0;
  const pctPartial   = totalUnits > 0 ? (unitsPartial / totalUnits) * 100 : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">

      {/* ── Page header ──────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--fiori-text)" }}>Inicio</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--fiori-text-muted)" }}>
          {formatMonthLabel(month)}
        </p>
      </div>

      {/* ── Hero: Fondo total del edificio ──────────────── */}
      <div className="rounded-xl p-5 sm:p-7" style={{ background: "#1e293b" }}>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
          {/* Left: main value */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#94a3b8" }}>
              Fondo total del edificio
            </p>
            <p
              className="text-4xl sm:text-5xl font-bold tabular-nums leading-none"
              style={{ color: totalBalance >= 0 ? "#ffffff" : "#fca5a5" }}
            >
              {formatCurrency(totalBalance)}
            </p>
          </div>

          {/* Right: breakdown */}
          <div
            className="space-y-2 border-t sm:border-t-0 sm:border-l pt-4 sm:pt-0 sm:pl-7"
            style={{ borderColor: "#334155" }}
          >
            <BreakdownRow label="Apertura del mes" value={formatCurrency(cashOpening + bankOpening)} color="#e2e8f0" />
            <BreakdownRow label="+ Ingresos" value={`+ ${formatCurrency(totalIn)}`} color="#4ade80" />
            {bankInterest > 0 && (
              <BreakdownRow label="+ Intereses Belo" value={`+ ${formatCurrency(bankInterest)}`} color="#93c5fd" />
            )}
            <BreakdownRow label="− Egresos" value={`− ${formatCurrency(totalOut)}`} color="#f87171" />
          </div>
        </div>
      </div>

      {/* ── Account balance cards ────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <AccountCard
          icon="💵"
          label="Caja (efectivo)"
          balance={cashBalance}
          opening={cashOpening}
          inflow={cashIn}
          outflow={cashOut}
          accentColor="#d97706"
          accentBg="#fffbeb"
          textColor="#92400e"
        />
        <AccountCard
          icon="🏦"
          label="Cta. Belo"
          balance={bankBalance}
          opening={bankOpening}
          inflow={bankIn + bankInterest}
          outflow={bankOut}
          accentColor="#3b82f6"
          accentBg="#eff6ff"
          textColor="#1d4ed8"
        />
      </div>

      {/* ── Cobro del mes ────────────────────────────────── */}
      <div className="bg-white rounded-xl p-5" style={CARD_STYLE}>
        <div className="flex items-start justify-between mb-4 gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--fiori-text-muted)" }}>
              Cobro del mes
            </p>
            <p className="text-sm font-medium" style={{ color: "var(--fiori-text)" }}>
              {unitsPaid} de {totalUnits} unidades pagaron
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p
              className="text-3xl font-bold tabular-nums leading-none"
              style={{ color: pctPaid >= 100 ? "var(--fiori-success)" : "var(--fiori-text)" }}
            >
              {Math.round(pctPaid)}%
            </p>
            <Link
              href={`/resumen?month=${month}`}
              className="text-xs mt-1 inline-block"
              style={{ color: "var(--fiori-blue)" }}
            >
              Ver resumen →
            </Link>
          </div>
        </div>

        <div className="w-full h-3 rounded-full overflow-hidden flex" style={{ background: "#e2e8f0" }}>
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${pctPaid}%`, background: "var(--fiori-success)" }}
          />
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${pctPartial}%`, background: "var(--fiori-warning)" }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-4 mt-3 text-xs" style={{ color: "var(--fiori-text-muted)" }}>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" style={{ background: "var(--fiori-success)" }} />
            Pagado ({unitsPaid})
          </span>
          {unitsPartial > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" style={{ background: "var(--fiori-warning)" }} />
              Parcial ({unitsPartial})
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" style={{ background: "#cbd5e1" }} />
            Pendiente ({unitsPending})
          </span>
        </div>
      </div>

      {/* ── Evolución del fondo chart ────────────────────── */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl p-5" style={CARD_STYLE}>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--fiori-text-muted)" }}>
            Evolución del fondo
          </p>
          <p className="text-xs mt-0.5 mb-4" style={{ color: "var(--fiori-text-muted)" }}>
            Últimos meses
          </p>
          <BalanceChart data={chartData} />
        </div>
      )}

      {/* ── Valor expensa del mes ────────────────────────── */}
      <div
        className="bg-white rounded-xl p-5"
        style={{ ...CARD_STYLE, borderLeft: "4px solid var(--fiori-blue)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--fiori-text-muted)" }}>
          Valor expensa del mes
        </p>
        <p
          className="text-2xl font-bold tabular-nums"
          style={{ color: feeAmount > 0 ? "var(--fiori-blue)" : "var(--fiori-text-muted)" }}
        >
          {feeAmount > 0 ? formatCurrency(feeAmount) : <span className="text-sm font-normal">No configurada</span>}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--fiori-text-muted)" }}>
          {formatMonthLabel(month)}
        </p>
      </div>

      {/* ── Avisos ───────────────────────────────────────── */}
      <div className="bg-white rounded-xl overflow-hidden" style={CARD_STYLE}>
        <div
          className="px-5 py-4 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--fiori-border)" }}
        >
          <h2 className="font-semibold text-sm" style={{ color: "var(--fiori-text)" }}>Avisos</h2>
          <Link href="/announcements" className="text-xs" style={{ color: "var(--fiori-blue)" }}>
            Ver todos →
          </Link>
        </div>
        {announcements.length === 0 ? (
          <p className="text-sm px-5 py-5" style={{ color: "var(--fiori-text-muted)" }}>
            Sin avisos publicados.
          </p>
        ) : (
          <div>
            {announcements.map((a, i) => (
              <div
                key={i}
                className="px-5 py-3.5"
                style={i < announcements.length - 1 ? { borderBottom: "1px solid var(--fiori-border)" } : undefined}
              >
                <p className="text-sm font-medium" style={{ color: "var(--fiori-text)" }}>{a.title}</p>
                <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--fiori-text-muted)" }}>{a.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Acciones rápidas ─────────────────────────────── */}
      <div className="bg-white rounded-xl overflow-hidden" style={CARD_STYLE}>
        <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--fiori-border)" }}>
          <h2 className="font-semibold text-sm" style={{ color: "var(--fiori-text)" }}>Acciones rápidas</h2>
        </div>
        <div className="grid grid-cols-2">
          {([
            { href: `/resumen?month=${month}`, label: "Ver resumen del mes", icon: "💳" },
            { href: `/resumen?month=${month}`, label: "Ver egresos del mes", icon: "📊" },
            { href: "/documents", label: "Subir documento", icon: "📄" },
            { href: "/announcements", label: "Nuevo aviso", icon: "📢" },
          ] as const).map(({ href, label, icon }, i) => (
            <Link
              key={label}
              href={href}
              className="flex items-center gap-3 p-4 min-h-[56px] transition-colors hover:bg-slate-50"
              style={{
                borderRight: i % 2 === 0 ? "1px solid var(--fiori-border)" : undefined,
                borderBottom: i < 2 ? "1px solid var(--fiori-border)" : undefined,
                color: "var(--fiori-text)",
              }}
            >
              <span className="text-xl leading-none">{icon}</span>
              <span className="text-sm font-medium">{label}</span>
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

const CARD_STYLE = {
  border: "1px solid var(--fiori-border)",
  boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.05)",
};

function BreakdownRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between gap-6 sm:justify-end">
      <span className="text-xs" style={{ color: "#94a3b8" }}>{label}</span>
      <span className="text-sm font-semibold tabular-nums" style={{ color }}>{value}</span>
    </div>
  );
}

function AccountCard({
  icon, label, balance, opening, inflow, outflow,
  accentColor, accentBg, textColor,
}: {
  icon: string; label: string; balance: number;
  opening: number; inflow: number; outflow: number;
  accentColor: string; accentBg: string; textColor: string;
}) {
  return (
    <div
      className="bg-white rounded-xl p-5"
      style={{
        border: "1px solid var(--fiori-border)",
        borderLeft: `4px solid ${accentColor}`,
        boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.05)",
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span
          className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
          style={{ background: accentBg }}
        >
          {icon}
        </span>
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--fiori-text-muted)" }}>
          {label}
        </span>
      </div>
      <p className="text-2xl font-bold tabular-nums" style={{ color: textColor }}>
        {formatCurrency(balance)}
      </p>
      <p className="text-xs mt-2" style={{ color: "var(--fiori-text-muted)" }}>
        {formatCurrency(opening)}&nbsp;+&nbsp;{formatCurrency(inflow)}&nbsp;−&nbsp;{formatCurrency(outflow)}
      </p>
    </div>
  );
}

// ── Resident Dashboard ───────────────────────────────────────────────────────

async function ResidentDashboard({
  unitId, month, name,
}: {
  unitId: string | null; month: string; name: string;
}) {
  if (!unitId) {
    return (
      <div className="p-4 text-center text-gray-500 mt-10">
        Tu unidad aún no está asignada. Contactá al administrador.
      </div>
    );
  }

  const svc = createServiceClient();

  const [feeRes, paymentsRes, unitRes, announcementsRes] = await Promise.all([
    svc.from("monthly_fees").select("amount").eq("month", month).single(),
    svc.from("payments").select("id, amount, date, method, receipt_url").eq("unit_id", unitId).eq("month", month).order("date"),
    svc.from("units").select("name, owner_name").eq("id", unitId).single(),
    svc.from("announcements").select("title, content, date").order("date", { ascending: false }).limit(3),
  ]);

  const feeAmount = feeRes.data?.amount ?? 0;
  const payments = paymentsRes.data ?? [];
  const cashPaid = payments.filter((p) => p.method === "efectivo").reduce((s, p) => s + Number(p.amount), 0);
  const bankPaid = payments.filter((p) => p.method === "transferencia").reduce((s, p) => s + Number(p.amount), 0);
  const totalPaid = cashPaid + bankPaid;
  const status = getPaymentStatus(totalPaid, feeAmount);
  const badgeVariant = status === "PAGADO" ? "green" : status === "PARCIAL" ? "yellow" : "red";
  const balance = totalPaid - feeAmount;

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <div className="pt-2">
        <h1 className="text-xl font-bold text-gray-900">Hola, {name.split(" ")[0]}</h1>
        <p className="text-sm text-gray-500">Unidad {unitRes.data?.name ?? ""} · {formatMonthLabel(month)}</p>
      </div>

      <Card className={status === "PAGADO" ? "border-green-200" : status === "PARCIAL" ? "border-yellow-200" : "border-red-200"}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Mi liquidación — {formatMonthLabel(month)}</p>
            <Badge variant={badgeVariant} className="text-sm px-3 py-1">{status}</Badge>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Expensa</p>
            <p className="text-lg font-bold text-gray-800">{formatCurrency(feeAmount)}</p>
          </div>
        </div>

        <div className="space-y-2 border-t border-gray-100 pt-3">
          {payments.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-1">Sin pagos registrados este mes</p>
          ) : (
            payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  {p.method === "efectivo" ? "💵" : "🏦"} {formatDate(p.date)}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-green-700">{formatCurrency(p.amount)}</span>
                  {p.method === "efectivo" && (
                    <a href={`/api/receipts/${p.id}`} target="_blank" rel="noreferrer" className="text-amber-500">🧾</a>
                  )}
                  {p.method === "transferencia" && p.receipt_url && (
                    <a href={p.receipt_url} target="_blank" rel="noreferrer" className="text-blue-500">📎</a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {feeAmount > 0 && (
          <div className="flex justify-between items-center border-t border-gray-100 pt-3 mt-2">
            <span className="text-sm text-gray-500">
              {balance >= 0 ? "A favor próximo mes" : "Saldo pendiente"}
            </span>
            <span className={`font-bold text-sm ${balance >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(Math.abs(balance))}
            </span>
          </div>
        )}
      </Card>

      {(announcementsRes.data ?? []).length > 0 && (
        <Card padding={false}>
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 text-sm">Avisos recientes</h2>
            <Link href="/announcements" className="text-xs text-blue-600">Ver todos →</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {(announcementsRes.data ?? []).map((a, i) => (
              <div key={i} className="px-4 py-3">
                <p className="text-sm font-medium text-gray-800">{a.title}</p>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{a.content}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link href="/payments" className="block">
          <Card className="hover:shadow-md transition-shadow text-center">
            <div className="text-2xl mb-1">💳</div>
            <p className="text-sm font-medium text-gray-700">Estado edificio</p>
          </Card>
        </Link>
        <Link href="/expenses" className="block">
          <Card className="hover:shadow-md transition-shadow text-center">
            <div className="text-2xl mb-1">📊</div>
            <p className="text-sm font-medium text-gray-700">Gastos comunes</p>
          </Card>
        </Link>
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("es-AR", {
    day: "2-digit", month: "2-digit",
  });
}
