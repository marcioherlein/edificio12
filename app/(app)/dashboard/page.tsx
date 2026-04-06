import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  formatCurrency, currentMonth, formatMonthLabel, getPaymentStatus,
} from "@/lib/utils";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Link from "next/link";
import AdminBalanceSetup from "./AdminBalanceSetup";
import BalanceChart, { MonthBalance } from "./BalanceChart";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, role, unit_id")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const month = currentMonth();

  if (profile.role === "admin") {
    return <AdminDashboard month={month} />;
  }

  return <ResidentDashboard unitId={profile.unit_id} month={month} name={profile.name} />;
}

// ── Admin Dashboard ──────────────────────────────────────────────────────────

async function AdminDashboard({ month }: { month: string }) {
  const svc = createServiceClient();

  const [allBalancesRes, allPaymentsRes, allExpensesRes, feesRes, unitsRes] = await Promise.all([
    svc.from("account_balances")
      .select("month, cash_opening, bank_opening, bank_interest")
      .order("month"),
    svc.from("payments").select("month, amount, method"),
    svc.from("expenses").select("date, amount, method"),
    svc.from("monthly_fees").select("amount").eq("month", month).single(),
    svc.from("units").select("id, name"),
  ]);

  const allBalances = allBalancesRes.data ?? [];
  const allPayments = allPaymentsRes.data ?? [];
  const allExpenses = allExpensesRes.data ?? [];

  // ── Per-month closing balance (for chart) ───────────────
  const chartData: MonthBalance[] = allBalances.map((ab) => {
    const m = ab.month;
    const cashIn = allPayments
      .filter(p => p.month === m && p.method === "efectivo")
      .reduce((s, p) => s + Number(p.amount), 0);
    const transferIn = allPayments
      .filter(p => p.month === m && p.method === "transferencia")
      .reduce((s, p) => s + Number(p.amount), 0);
    const cashOut = allExpenses
      .filter(e => e.date.startsWith(m) && (e.method ?? "transferencia") === "efectivo")
      .reduce((s, e) => s + Number(e.amount), 0);
    const transferOut = allExpenses
      .filter(e => e.date.startsWith(m) && (e.method ?? "transferencia") !== "efectivo")
      .reduce((s, e) => s + Number(e.amount), 0);
    return {
      month: m,
      caja: Number(ab.cash_opening) + cashIn - cashOut,
      uala: Number(ab.bank_opening) + transferIn + Number((ab as any).bank_interest ?? 0) - transferOut,
    };
  });

  // ── Current month balance ────────────────────────────────
  const currentAb = allBalances.find(ab => ab.month === month);
  const cashOpening  = Number(currentAb?.cash_opening ?? 0);
  const bankOpening  = Number(currentAb?.bank_opening ?? 0);
  const bankInterest = Number((currentAb as any)?.bank_interest ?? 0);
  const openingSet   = !!currentAb;

  const cashIn  = allPayments.filter(p => p.month === month && p.method === "efectivo").reduce((s, p) => s + Number(p.amount), 0);
  const bankIn  = allPayments.filter(p => p.month === month && p.method === "transferencia").reduce((s, p) => s + Number(p.amount), 0);
  const cashOut = allExpenses.filter(e => e.date.startsWith(month) && (e.method ?? "transferencia") === "efectivo").reduce((s, e) => s + Number(e.amount), 0);
  const bankOut = allExpenses.filter(e => e.date.startsWith(month) && (e.method ?? "transferencia") !== "efectivo").reduce((s, e) => s + Number(e.amount), 0);

  const cashBalance  = cashOpening + cashIn - cashOut;
  const bankBalance  = bankOpening + bankIn + bankInterest - bankOut;
  const totalBalance = cashBalance + bankBalance;
  const totalIn      = cashIn + bankIn;
  const totalOut     = cashOut + bankOut;

  const feeAmount = feesRes.data?.amount ?? 0;

  // Current month payment totals per unit
  const { data: monthUnitPayments } = await svc
    .from("payments")
    .select("unit_id, amount")
    .eq("month", month);

  const paidByUnit: Record<string, number> = {};
  for (const p of monthUnitPayments ?? []) {
    paidByUnit[p.unit_id] = (paidByUnit[p.unit_id] ?? 0) + Number(p.amount);
  }

  const units = unitsRes.data ?? [];
  const pendingCount = feeAmount > 0
    ? units.filter((u) => getPaymentStatus(paidByUnit[u.id] ?? 0, feeAmount) !== "PAGADO").length
    : 0;

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Resumen general</h1>
          <p className="text-sm text-gray-500">{formatMonthLabel(month)}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/reports/${month}`}
            className="text-xs text-blue-600 hover:text-blue-700 border border-blue-200 rounded-lg px-3 py-1.5 bg-blue-50 transition-colors">
            📄 Reporte
          </Link>
        </div>
      </div>

      {/* Opening balance setup */}
      {!openingSet && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-orange-800 mb-1">⚠️ Saldo inicial del mes no configurado</p>
          <p className="text-xs text-orange-600 mb-3">
            Para mostrar el fondo total correctamente, ingresá el saldo arrastrado del mes anterior.
          </p>
          <AdminBalanceSetup month={month} />
        </div>
      )}

      {/* Two-account balance cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
          <p className="text-amber-100 text-xs font-medium mb-0.5">💵 Caja (efectivo)</p>
          <p className="text-xl font-bold">{formatCurrency(cashBalance)}</p>
          <p className="text-amber-200 text-[11px] mt-1">
            Abre: {formatCurrency(cashOpening)} + {formatCurrency(cashIn)} − {formatCurrency(cashOut)}
          </p>
        </Card>
        <Card className="bg-gradient-to-br from-blue-600 to-blue-700 text-white">
          <p className="text-blue-100 text-xs font-medium mb-0.5">🏦 Cta. Ualá</p>
          <p className="text-xl font-bold">{formatCurrency(bankBalance)}</p>
          <p className="text-blue-200 text-[11px] mt-1">
            Abre: {formatCurrency(bankOpening)} + {formatCurrency(bankIn)} − {formatCurrency(bankOut)}
          </p>
        </Card>
      </div>

      {/* Total fund */}
      <Card className="bg-gradient-to-br from-gray-800 to-gray-900 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-xs font-medium mb-0.5">Fondo total del edificio</p>
            <p className={`text-3xl font-bold ${totalBalance >= 0 ? "text-white" : "text-red-300"}`}>
              {formatCurrency(totalBalance)}
            </p>
          </div>
          <div className="text-right text-xs text-gray-400 space-y-1">
            <p>Ingresos mes: <span className="text-green-400 font-semibold">{formatCurrency(totalIn)}</span></p>
            <p>Egresos mes: <span className="text-red-400 font-semibold">{formatCurrency(totalOut)}</span></p>
          </div>
        </div>
      </Card>

      {/* Monthly balance chart */}
      {chartData.length > 0 && (
        <Card>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Evolución del fondo
          </p>
          <BalanceChart data={chartData} />
        </Card>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-xs text-gray-500 mb-1">Pendientes este mes</p>
          <p className="text-2xl font-bold text-orange-600">{pendingCount}</p>
          <p className="text-xs text-gray-400 mt-0.5">de {units.length} unidades</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 mb-1">Expensa del mes</p>
          <p className="text-xl font-bold text-blue-600 truncate">
            {feeAmount > 0 ? formatCurrency(feeAmount) : <span className="text-sm text-gray-400">No configurada</span>}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{formatMonthLabel(month)}</p>
        </Card>
      </div>

      {/* Quick actions */}
      <Card padding={false}>
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-sm">Acciones rápidas</h2>
        </div>
        <div className="grid grid-cols-2 divide-x divide-y divide-gray-100">
          {[
            { href: "/payments", label: "Registrar pago", icon: "💳" },
            { href: "/expenses", label: "Registrar gasto", icon: "📊" },
            { href: "/documents", label: "Subir documento", icon: "📄" },
            { href: "/announcements", label: "Nuevo aviso", icon: "📢" },
          ].map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors"
            >
              <span className="text-2xl">{icon}</span>
              <span className="text-sm font-medium text-gray-700">{label}</span>
            </Link>
          ))}
        </div>
      </Card>

      {/* Unit status table */}
      {feeAmount > 0 && (
        <Card padding={false}>
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-sm">Liquidación — {formatMonthLabel(month)}</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {units.map((unit) => {
              const paid = paidByUnit[unit.id] ?? 0;
              const status = getPaymentStatus(paid, feeAmount);
              const badgeVariant = status === "PAGADO" ? "green" : status === "PARCIAL" ? "yellow" : "red";
              return (
                <div key={unit.id} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-gray-700 font-medium w-12">{unit.name}</span>
                  <div className="flex items-center gap-2">
                    {paid > 0 && status !== "PAGADO" && (
                      <span className="text-xs text-gray-400">{formatCurrency(paid)}</span>
                    )}
                    <Badge variant={badgeVariant}>{status}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
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
  const balance = totalPaid - feeAmount; // positive = credit, negative = debt

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <div className="pt-2">
        <h1 className="text-xl font-bold text-gray-900">Hola, {name.split(" ")[0]}</h1>
        <p className="text-sm text-gray-500">Unidad {unitRes.data?.name ?? ""} · {formatMonthLabel(month)}</p>
      </div>

      {/* Liquidación card */}
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

      {/* Recent announcements */}
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
