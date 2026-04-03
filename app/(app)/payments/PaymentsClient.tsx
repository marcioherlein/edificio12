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
  feeAmount: number;
  month: string;
  isAdmin: boolean;
  myUnitId: string | null;
}

export default function PaymentsClient({
  payments, units, paidByUnit, feeAmount, month, isAdmin, myUnitId,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [newReceipt, setNewReceipt] = useState<{ id: string; isCash: boolean } | null>(null);

  function handleSuccess(paymentId: string, isCash: boolean) {
    setOpen(false);
    setNewReceipt({ id: paymentId, isCash });
    router.refresh();
  }

  const formUnits = units.map(({ id, name }) => ({ id, name }));

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-5">
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

      {/* ── Building status table (all users) ── */}
      {feeAmount > 0 && (
        <Card padding={false}>
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-sm">
              Estado del edificio — {formatMonthLabel(month)}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Expensa: {formatCurrency(feeAmount)} · Visible para todos los vecinos
            </p>
          </div>
          <div className="divide-y divide-gray-50">
            {units.map((unit) => {
              const paid = paidByUnit[unit.id] ?? 0;
              const status = getPaymentStatus(paid, feeAmount);
              const isMe = unit.id === myUnitId;
              const badgeVariant = status === "PAGADO" ? "green" : status === "PARCIAL" ? "yellow" : "red";
              return (
                <div
                  key={unit.id}
                  className={`flex items-center justify-between px-4 py-2.5 ${isMe ? "bg-blue-50" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 w-10">{unit.name}</span>
                    <span className="text-xs text-gray-400">{unit.owner_name}</span>
                    {isMe && <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-medium">vos</span>}
                  </div>
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

      {/* ── Payment history ── */}
      <div>
        <h2 className="font-semibold text-gray-900 text-sm mb-2">
          {isAdmin ? "Historial de pagos" : "Mis pagos"}
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
                      <span className="text-gray-500 font-normal">{p.month}</span>
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
                    {/* Transfer: view uploaded receipt */}
                    {p.method === "transferencia" && p.receipt_url && (
                      <a href={p.receipt_url} target="_blank" rel="noreferrer" title="Ver comprobante" className="text-blue-500 hover:text-blue-700">
                        📎
                      </a>
                    )}
                    {/* Cash: auto-generated receipt */}
                    {p.method === "efectivo" && (
                      <a href={`/api/receipts/${p.id}`} target="_blank" rel="noreferrer" title="Comprobante" className="text-amber-500 hover:text-amber-700">
                        🧾
                      </a>
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
