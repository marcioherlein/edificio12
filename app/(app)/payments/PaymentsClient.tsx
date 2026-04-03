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
  isAdmin: boolean;
  myUnitId: string | null;
}

export default function PaymentsClient({
  payments, units, paidByUnit, cashByUnit, transferByUnit,
  lastPaymentDateByUnit, openingByUnit, feeAmount, month, isAdmin, myUnitId,
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

  const formUnits = units.map(({ id, name }) => ({ id, name }));

  // Payments for current month only, grouped by unit for detail expansion
  const currentMonthPayments = payments.filter(p => p.month === month);
  const paymentsByUnit: Record<string, Payment[]> = {};
  for (const p of currentMonthPayments) {
    if (!paymentsByUnit[p.unit_id]) paymentsByUnit[p.unit_id] = [];
    paymentsByUnit[p.unit_id].push(p);
  }

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-xl font-bold text-gray-900">Pagos</h1>
        {isAdmin && (
          <Button size="sm" onClick={() => setOpen(true)}>+ Registrar pago</Button>
        )}
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

      {/* ── Liquidación del mes ── */}
      {feeAmount > 0 && (
        <Card padding={false}>
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-sm">
              Liquidación — {formatMonthLabel(month)}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Expensa: {formatCurrency(feeAmount)} · Tocá una fila para ver el detalle
            </p>
          </div>

          {/* Header row */}
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
              const totalOwed = anterior + feeAmount;
              const paid = paidByUnit[unit.id] ?? 0;
              const cash = cashByUnit[unit.id] ?? 0;
              const transfer = transferByUnit[unit.id] ?? 0;
              const lastDate = lastPaymentDateByUnit[unit.id];
              const status = getPaymentStatus(paid, totalOwed);
              const isMe = unit.id === myUnitId;
              const badgeVariant = status === "PAGADO" ? "green" : status === "PARCIAL" ? "yellow" : "red";
              const isOpen = expanded === unit.id;
              const unitPayments = paymentsByUnit[unit.id] ?? [];

              return (
                <div key={unit.id}>
                  {/* Main row */}
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : unit.id)}
                    className={`w-full text-left sm:grid sm:grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr_1.5fr_1.2fr] gap-x-2 px-4 py-3 hover:bg-gray-50 transition-colors ${isMe ? "bg-blue-50 hover:bg-blue-100" : ""}`}
                  >
                    {/* Mobile layout */}
                    <div className="sm:hidden flex items-center justify-between">
                      <div>
                        <span className="text-sm font-semibold text-gray-800">{unit.name}</span>
                        <span className="text-xs text-gray-400 ml-2">{unit.owner_name}</span>
                        {isMe && <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-medium ml-1">vos</span>}
                        {anterior > 0 && (
                          <span className="block text-xs text-amber-600 mt-0.5">Anterior: {formatCurrency(anterior)}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {paid > 0 && (
                          <span className="text-xs text-gray-500">{formatCurrency(paid)}</span>
                        )}
                        <Badge variant={badgeVariant}>{status}</Badge>
                      </div>
                    </div>

                    {/* Desktop layout */}
                    <span className="hidden sm:flex items-center gap-1.5 text-sm font-semibold text-gray-800">
                      {unit.name}
                      {isMe && <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-medium">vos</span>}
                    </span>
                    <span className="hidden sm:block text-xs text-gray-500 self-center truncate">{unit.owner_name}</span>
                    <span className={`hidden sm:block text-xs text-right self-center ${anterior > 0 ? "text-amber-600 font-medium" : "text-gray-300"}`}>
                      {anterior > 0 ? formatCurrency(anterior) : "—"}
                    </span>
                    <span className="hidden sm:block text-xs text-right self-center text-gray-600">{formatCurrency(feeAmount)}</span>
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
                  {isOpen && unitPayments.length > 0 && (
                    <div className="bg-gray-50 border-t border-gray-100 px-4 py-3 space-y-2">
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
                        Detalle de pagos — {formatMonthLabel(month)}
                      </p>
                      {unitPayments.map((p) => (
                        <div key={p.id} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400 text-xs">{formatDate(p.date)}</span>
                            <span className="text-xs text-gray-500">
                              {p.method === "efectivo" ? "💵 Efectivo" : "🏦 Transferencia"}
                            </span>
                            {p.notes && <span className="text-xs text-gray-400 italic">{p.notes}</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-800">{formatCurrency(p.amount)}</span>
                            {p.method === "transferencia" && p.receipt_url && (
                              <a href={p.receipt_url} target="_blank" rel="noreferrer" title="Ver comprobante" className="text-blue-500 hover:text-blue-700">📎</a>
                            )}
                            {p.method === "efectivo" && (
                              <a href={`/api/receipts/${p.id}`} target="_blank" rel="noreferrer" title="Comprobante" className="text-amber-500 hover:text-amber-700">🧾</a>
                            )}
                          </div>
                        </div>
                      ))}
                      {anterior > 0 && (
                        <div className="pt-2 border-t border-gray-200 text-xs text-amber-700">
                          Deuda anterior: {formatCurrency(anterior)} · Total adeudado: {formatCurrency(anterior + feeAmount)}
                        </div>
                      )}
                    </div>
                  )}
                  {isOpen && unitPayments.length === 0 && (
                    <div className="bg-gray-50 border-t border-gray-100 px-4 py-3 text-xs text-gray-400">
                      Sin pagos registrados para {formatMonthLabel(month)}.
                      {anterior > 0 && ` Deuda anterior: ${formatCurrency(anterior)}.`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ── Payment history (all months) ── */}
      <div>
        <h2 className="font-semibold text-gray-900 text-sm mb-2">
          {isAdmin ? "Historial completo de pagos" : "Mis pagos"}
        </h2>
        {payments.length === 0 ? (
          <Card>
            <p className="text-sm text-gray-500 text-center py-4">No hay pagos registrados.</p>
          </Card>
        ) : (
          <Card padding={false}>
            <div className="divide-y divide-gray-50">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-4 py-3.5">
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {isAdmin && p.units ? `${p.units.name} · ` : ""}
                      <span className="text-gray-500 font-normal">{formatMonthLabel(p.month)}</span>
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">
                        {formatDate(p.date)} · {p.method === "efectivo" ? "💵 Efectivo" : "🏦 Transferencia"}
                      </span>
                      {p.notes && <span className="text-xs text-gray-400">· {p.notes}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm font-semibold text-green-700">{formatCurrency(p.amount)}</span>
                    {p.method === "transferencia" && p.receipt_url && (
                      <a href={p.receipt_url} target="_blank" rel="noreferrer" title="Ver comprobante" className="text-blue-500 hover:text-blue-700">📎</a>
                    )}
                    {p.method === "efectivo" && (
                      <a href={`/api/receipts/${p.id}`} target="_blank" rel="noreferrer" title="Comprobante" className="text-amber-500 hover:text-amber-700">🧾</a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

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
