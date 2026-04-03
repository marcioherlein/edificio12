"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDate, formatMonthLabel, getPaymentStatus } from "@/lib/utils";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import PaymentForm from "@/components/admin/PaymentForm";

interface Payment {
  id: string;
  unit_id: string;
  amount: number;
  method: string;
  date: string;
  month: string;
  notes: string | null;
  receipt_url: string | null;
  units: { name: string } | null;
}

interface Unit { id: string; name: string; owner_name: string; }

interface Props {
  payments: Payment[];
  units: Unit[];
  paidByUnit: Record<string, number>;
  cashByUnit: Record<string, number>;
  transferByUnit: Record<string, number>;
  lastPaymentDateByUnit: Record<string, string>;
  openingByUnit: Record<string, number>;
  feeAmount: number;
  month: string;
  availableMonths: string[];
  isAdmin: boolean;
  myUnitId: string | null;
}

export default function PaymentsClient({
  payments, units, paidByUnit, cashByUnit, transferByUnit,
  lastPaymentDateByUnit, openingByUnit, feeAmount, month,
  availableMonths, isAdmin, myUnitId,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newReceipt, setNewReceipt] = useState<{ id: string; isCash: boolean } | null>(null);

  function handleSuccess(paymentId: string, isCash: boolean) {
    setOpen(false);
    setNewReceipt({ id: paymentId, isCash });
    router.refresh();
  }

  function goToMonth(m: string) {
    router.push(`/payments?month=${m}`);
  }

  const formUnits = units.map(({ id, name }) => ({ id, name }));

  // Payments for this month grouped by unit for row expansion
  const paymentsByUnit: Record<string, Payment[]> = {};
  for (const p of payments) {
    if (!paymentsByUnit[p.unit_id]) paymentsByUnit[p.unit_id] = [];
    paymentsByUnit[p.unit_id].push(p);
  }

  // Summary totals
  const totalCollected = Object.values(paidByUnit).reduce((a, b) => a + b, 0);
  const totalCash = Object.values(cashByUnit).reduce((a, b) => a + b, 0);
  const totalTransfer = Object.values(transferByUnit).reduce((a, b) => a + b, 0);
  const pendingUnits = units.filter((u) => {
    const anterior = openingByUnit[u.id] ?? 0;
    const paid = paidByUnit[u.id] ?? 0;
    return getPaymentStatus(paid, anterior + (feeAmount || 0)) !== "PAGADO";
  }).length;

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-xl font-bold text-gray-900">Pagos</h1>
        {isAdmin && (
          <Button size="sm" onClick={() => setOpen(true)}>+ Registrar pago</Button>
        )}
      </div>

      {/* Month selector */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {availableMonths.map((m) => (
          <button
            key={m}
            onClick={() => goToMonth(m)}
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

      {/* Cash receipt notification */}
      {newReceipt?.isCash && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-green-800">✅ Pago registrado</p>
            <p className="text-xs text-green-600 mt-0.5">Comprobante generado automáticamente</p>
          </div>
          <a
            href={`/api/receipts/${newReceipt.id}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-green-700 underline underline-offset-2 whitespace-nowrap"
          >
            Descargar comprobante →
          </a>
        </div>
      )}

      {/* Summary chips */}
      {feeAmount > 0 && (
        <div className="flex gap-3 flex-wrap text-xs">
          <div className="bg-white border border-gray-200 rounded-lg px-3 py-2">
            <span className="text-gray-400">Recaudado </span>
            <span className="font-semibold text-gray-800">{formatCurrency(totalCollected)}</span>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg px-3 py-2">
            <span className="text-gray-400">💵 Efectivo </span>
            <span className="font-semibold text-green-700">{formatCurrency(totalCash)}</span>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg px-3 py-2">
            <span className="text-gray-400">🏦 Transferencia </span>
            <span className="font-semibold text-blue-700">{formatCurrency(totalTransfer)}</span>
          </div>
          {pendingUnits > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <span className="text-red-500 font-semibold">{pendingUnits} pendiente{pendingUnits !== 1 ? "s" : ""}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Liquidación table ── */}
      <Card padding={false}>
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-sm">
            Liquidación — {formatMonthLabel(month)}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {feeAmount > 0 ? `Expensa: ${formatCurrency(feeAmount)} · ` : "Sin expensa configurada · "}
            Tocá una fila para ver el detalle
          </p>
        </div>

        {/* Desktop header */}
        <div className="hidden sm:grid grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr_1.5fr_1.2fr] gap-x-2 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400 border-b border-gray-100">
          <span>Depto</span>
          <span>Propietario</span>
          <span className="text-right">Anterior</span>
          <span className="text-right">Expensa</span>
          <span className="text-right">Efectivo</span>
          <span className="text-right">Transf.</span>
          <span className="text-right">Fecha</span>
          <span className="text-center">Estado</span>
        </div>

        <div className="divide-y divide-gray-50">
          {units.map((unit) => {
            const anterior = openingByUnit[unit.id] ?? 0;
            const totalOwed = anterior + (feeAmount || 0);
            const paid = paidByUnit[unit.id] ?? 0;
            const cash = cashByUnit[unit.id] ?? 0;
            const transfer = transferByUnit[unit.id] ?? 0;
            const lastDate = lastPaymentDateByUnit[unit.id];
            const status = totalOwed > 0
              ? getPaymentStatus(paid, totalOwed)
              : paid > 0 ? "PAGADO" : "PENDIENTE";
            const isMe = unit.id === myUnitId;
            const badgeVariant = status === "PAGADO" ? "green" : status === "PARCIAL" ? "yellow" : "red";
            const isOpen = expanded === unit.id;
            const unitPayments = paymentsByUnit[unit.id] ?? [];

            return (
              <div key={unit.id}>
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : unit.id)}
                  className={`w-full text-left sm:grid sm:grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr_1.5fr_1.2fr] gap-x-2 px-4 py-3 hover:bg-gray-50 transition-colors ${isMe ? "bg-blue-50 hover:bg-blue-100" : ""}`}
                >
                  {/* Mobile */}
                  <div className="sm:hidden flex items-center justify-between">
                    <div>
                      <span className="text-sm font-semibold text-gray-800">{unit.name}</span>
                      <span className="text-xs text-gray-400 ml-2">{unit.owner_name}</span>
                      {isMe && <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-medium ml-1">vos</span>}
                      {anterior > 0 && (
                        <span className="block text-xs text-amber-600 mt-0.5">Anterior: {formatCurrency(anterior)}</span>
                      )}
                      {paid > 0 && (
                        <span className="block text-xs text-gray-500 mt-0.5">
                          {cash > 0 && `💵 ${formatCurrency(cash)}`}
                          {cash > 0 && transfer > 0 && " · "}
                          {transfer > 0 && `🏦 ${formatCurrency(transfer)}`}
                        </span>
                      )}
                    </div>
                    <Badge variant={badgeVariant}>{status}</Badge>
                  </div>

                  {/* Desktop */}
                  <span className="hidden sm:flex items-center gap-1.5 text-sm font-semibold text-gray-800">
                    {unit.name}
                    {isMe && <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-medium">vos</span>}
                  </span>
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
                  <span className="hidden sm:flex justify-center self-center">
                    <Badge variant={badgeVariant}>{status}</Badge>
                  </span>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="bg-gray-50 border-t border-gray-100 px-4 py-3 space-y-2">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                      Detalle — {formatMonthLabel(month)}
                    </p>
                    {anterior > 0 && (
                      <div className="flex justify-between text-xs text-amber-700 pb-2 border-b border-amber-100">
                        <span>Deuda anterior</span>
                        <span className="font-semibold">{formatCurrency(anterior)}</span>
                      </div>
                    )}
                    {unitPayments.length === 0 ? (
                      <p className="text-xs text-gray-400">Sin pagos registrados para este mes.</p>
                    ) : (
                      unitPayments.map((p) => (
                        <div key={p.id} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-gray-400 text-xs">{formatDate(p.date)}</span>
                            <span className="text-xs text-gray-500">
                              {p.method === "efectivo" ? "💵 Efectivo" : "🏦 Transferencia"}
                            </span>
                            {p.notes && <span className="text-xs text-gray-400 italic">{p.notes}</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-800">{formatCurrency(p.amount)}</span>
                            {p.method === "transferencia" && p.receipt_url && (
                              <a href={p.receipt_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700">📎</a>
                            )}
                            {p.method === "efectivo" && (
                              <a href={`/api/receipts/${p.id}`} target="_blank" rel="noreferrer" className="text-amber-500 hover:text-amber-700">🧾</a>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                    {totalOwed > 0 && (
                      <div className="pt-2 border-t border-gray-200 flex justify-between text-xs">
                        <span className="text-gray-400">Total adeudado</span>
                        <span className={`font-semibold ${paid >= totalOwed ? "text-green-700" : "text-red-600"}`}>
                          {formatCurrency(totalOwed)} {paid >= totalOwed ? "✓" : `· Pagó ${formatCurrency(paid)}`}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {isAdmin && (
        <Modal open={open} onClose={() => setOpen(false)} title="Registrar pago">
          <PaymentForm
            units={formUnits}
            onSuccess={handleSuccess}
            onCancel={() => setOpen(false)}
          />
        </Modal>
      )}
    </div>
  );
}
