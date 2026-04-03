import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatCurrency, currentMonth, formatMonthLabel, getPaymentStatus } from "@/lib/utils";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Link from "next/link";

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

  const [paymentsRes, expensesRes, feesRes, unitsRes] = await Promise.all([
    svc.from("payments").select("amount"),
    svc.from("expenses").select("amount"),
    svc.from("monthly_fees").select("amount").eq("month", month).single(),
    svc.from("units").select("id, name"),
  ]);

  const totalPayments = (paymentsRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const totalExpenses = (expensesRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const balance = totalPayments - totalExpenses;
  const feeAmount = feesRes.data?.amount ?? 0;

  // Get current month payment totals per unit
  const { data: monthPayments } = await svc
    .from("payments")
    .select("unit_id, amount")
    .eq("month", month);

  const paidByUnit: Record<string, number> = {};
  for (const p of monthPayments ?? []) {
    paidByUnit[p.unit_id] = (paidByUnit[p.unit_id] ?? 0) + Number(p.amount);
  }

  const units = unitsRes.data ?? [];
  const pendingCount = feeAmount > 0
    ? units.filter((u) => getPaymentStatus(paidByUnit[u.id] ?? 0, feeAmount) !== "PAGADO").length
    : 0;

  const balanceColor = balance >= 0 ? "text-green-600" : "text-red-600";

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-gray-900 pt-2">Resumen general</h1>
      <p className="text-sm text-gray-500 -mt-2">{formatMonthLabel(month)}</p>

      {/* Balance card */}
      <Card className="bg-gradient-to-br from-blue-600 to-blue-700 text-white" padding={false}>
        <div className="p-5">
          <p className="text-blue-200 text-sm font-medium mb-1">Balance del edificio</p>
          <p className={`text-3xl font-bold ${balance >= 0 ? "text-white" : "text-red-200"}`}>
            {formatCurrency(balance)}
          </p>
          <div className="flex gap-4 mt-3 text-sm">
            <span className="text-blue-200">
              Ingresos: <span className="text-white font-semibold">{formatCurrency(totalPayments)}</span>
            </span>
            <span className="text-blue-200">
              Gastos: <span className="text-white font-semibold">{formatCurrency(totalExpenses)}</span>
            </span>
          </div>
        </div>
      </Card>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-xs text-gray-500 mb-1">Unidades pendientes</p>
          <p className="text-2xl font-bold text-orange-600">{pendingCount}</p>
          <p className="text-xs text-gray-400 mt-0.5">de {units.length} unidades</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 mb-1">Expensa del mes</p>
          <p className="text-2xl font-bold text-blue-600">
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

      {/* Unit payment status */}
      {feeAmount > 0 && (
        <Card padding={false}>
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 text-sm">Estado de pagos — {formatMonthLabel(month)}</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {units.map((unit) => {
              const paid = paidByUnit[unit.id] ?? 0;
              const status = getPaymentStatus(paid, feeAmount);
              const badgeVariant = status === "PAGADO" ? "green" : status === "PARCIAL" ? "yellow" : "red";
              return (
                <div key={unit.id} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-gray-700 font-medium">{unit.name}</span>
                  <div className="flex items-center gap-2">
                    {paid > 0 && (
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
  unitId,
  month,
  name,
}: {
  unitId: string | null;
  month: string;
  name: string;
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
    svc.from("payments").select("amount, date, method").eq("unit_id", unitId).eq("month", month),
    svc.from("units").select("name").eq("id", unitId).single(),
    svc.from("announcements").select("title, content, date").order("date", { ascending: false }).limit(3),
  ]);

  const feeAmount = feeRes.data?.amount ?? 0;
  const paid = (paymentsRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const status = getPaymentStatus(paid, feeAmount);
  const badgeVariant = status === "PAGADO" ? "green" : status === "PARCIAL" ? "yellow" : "red";

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <div className="pt-2">
        <h1 className="text-xl font-bold text-gray-900">Hola, {name.split(" ")[0]}</h1>
        <p className="text-sm text-gray-500">Unidad {unitRes.data?.name ?? ""} · {formatMonthLabel(month)}</p>
      </div>

      {/* Payment status card */}
      <Card
        className={status === "PAGADO" ? "border-green-200 bg-green-50" : status === "PARCIAL" ? "border-yellow-200 bg-yellow-50" : "border-red-200 bg-red-50"}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">Estado del mes</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(feeAmount)}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {paid > 0 ? `Pagado: ${formatCurrency(paid)}` : "Sin pagos registrados"}
            </p>
          </div>
          <Badge variant={badgeVariant} className="text-sm px-3 py-1">{status}</Badge>
        </div>
      </Card>

      {/* Recent announcements */}
      {(announcementsRes.data ?? []).length > 0 && (
        <Card padding={false}>
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 text-sm">Avisos recientes</h2>
            <Link href="/announcements" className="text-xs text-blue-600 hover:underline">Ver todos</Link>
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

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/payments" className="block">
          <Card className="hover:shadow-md transition-shadow">
            <div className="text-center">
              <div className="text-2xl mb-1">💳</div>
              <p className="text-sm font-medium text-gray-700">Mis pagos</p>
            </div>
          </Card>
        </Link>
        <Link href="/expenses" className="block">
          <Card className="hover:shadow-md transition-shadow">
            <div className="text-center">
              <div className="text-2xl mb-1">📊</div>
              <p className="text-sm font-medium text-gray-700">Expensas</p>
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}
