"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import ExpenseForm from "@/components/admin/ExpenseForm";

interface Expense {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: string;
  method: string | null;
  receipt_url: string | null;
}

interface Category { id: string; name: string; }

interface Props {
  expenses: Expense[];
  categories: Category[];
  isAdmin: boolean;
}

export default function ExpensesClient({ expenses, categories, isAdmin }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [newExpense, setNewExpense] = useState<{ id: string; isCash: boolean } | null>(null);

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const cashTotal = expenses
    .filter((e) => e.method === "efectivo")
    .reduce((s, e) => s + Number(e.amount), 0);

  function handleSuccess(expenseId: string, isCash: boolean) {
    setOpen(false);
    setNewExpense({ id: expenseId, isCash });
    router.refresh();
  }

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Gastos del edificio</h1>
          <div className="flex gap-3 mt-0.5">
            <p className="text-sm text-gray-500">Total: <strong className="text-red-600">{formatCurrency(total)}</strong></p>
            {cashTotal > 0 && (
              <p className="text-sm text-gray-500">Efectivo: <strong className="text-amber-700">{formatCurrency(cashTotal)}</strong></p>
            )}
          </div>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setOpen(true)}>+ Registrar gasto</Button>
        )}
      </div>

      {/* Cash receipt notification */}
      {newExpense?.isCash && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-amber-800">✅ Gasto en efectivo registrado</p>
            <p className="text-xs text-amber-600 mt-0.5">Comprobante de egreso generado</p>
          </div>
          <a
            href={`/api/expense-receipts/${newExpense.id}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-amber-700 underline underline-offset-2 whitespace-nowrap"
          >
            Descargar comprobante →
          </a>
        </div>
      )}

      {expenses.length === 0 ? (
        <Card>
          <p className="text-sm text-gray-500 text-center py-4">No hay gastos registrados.</p>
        </Card>
      ) : (
        <Card padding={false}>
          <div className="divide-y divide-gray-50">
            {expenses.map((e) => (
              <div key={e.id} className="flex items-start justify-between px-4 py-3.5 gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{e.description}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-gray-400">{formatDate(e.date)}</span>
                    <Badge variant="gray">{e.category}</Badge>
                    {e.method && (
                      <span className="text-xs text-gray-400">
                        {e.method === "efectivo" ? "💵 Efectivo" : "🏦 Transf."}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                  <span className="text-sm font-semibold text-red-600">{formatCurrency(e.amount)}</span>
                  {/* Transfer: view uploaded receipt */}
                  {e.method === "transferencia" && e.receipt_url && (
                    <a href={e.receipt_url} target="_blank" rel="noreferrer" title="Ver comprobante" className="text-blue-500 hover:text-blue-700">
                      📎
                    </a>
                  )}
                  {/* Cash: auto-generated egreso receipt */}
                  {e.method === "efectivo" && (
                    <a href={`/api/expense-receipts/${e.id}`} target="_blank" rel="noreferrer" title="Comprobante de egreso" className="text-amber-500 hover:text-amber-700">
                      🧾
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {isAdmin && (
        <Modal open={open} onClose={() => setOpen(false)} title="Registrar gasto">
          <ExpenseForm
            categories={categories}
            onSuccess={handleSuccess}
            onCancel={() => setOpen(false)}
          />
        </Modal>
      )}
    </div>
  );
}
