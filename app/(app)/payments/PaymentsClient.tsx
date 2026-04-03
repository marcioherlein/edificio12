"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import PaymentForm from "@/components/admin/PaymentForm";

interface Payment {
  id: string;
  amount: number;
  method: string;
  date: string;
  month: string;
  notes: string | null;
  units: { name: string } | null;
}

interface Unit { id: string; name: string; }

interface Props {
  payments: Payment[];
  units: Unit[];
  isAdmin: boolean;
}

export default function PaymentsClient({ payments, units, isAdmin }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function handleSuccess() {
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-xl font-bold text-gray-900">Pagos</h1>
        {isAdmin && (
          <Button size="sm" onClick={() => setOpen(true)}>+ Registrar pago</Button>
        )}
      </div>

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
                    {isAdmin && p.units ? p.units.name + " · " : ""}
                    <span className="text-gray-500 font-normal">{p.month}</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDate(p.date)} · {p.method === "efectivo" ? "Efectivo" : "Transferencia"}
                    {p.notes ? ` · ${p.notes}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-green-700">{formatCurrency(p.amount)}</span>
                  <a
                    href={`/api/receipts/${p.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-500 hover:text-blue-700 transition-colors"
                    title="Ver comprobante"
                  >
                    🧾
                  </a>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {isAdmin && (
        <Modal open={open} onClose={() => setOpen(false)} title="Registrar pago">
          <PaymentForm units={units} onSuccess={handleSuccess} />
        </Modal>
      )}
    </div>
  );
}
