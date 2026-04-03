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
}

interface Props { expenses: Expense[]; isAdmin: boolean; }

const CATEGORY_COLORS: Record<string, "blue" | "green" | "red" | "yellow" | "gray"> = {
  "Mantenimiento": "blue",
  "Limpieza": "green",
  "Seguridad": "red",
  "Reparaciones": "yellow",
  "Administración": "gray",
  "Servicios (agua/luz/gas)": "blue",
  "Seguros": "gray",
  "Otros": "gray",
};

export default function ExpensesClient({ expenses, isAdmin }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  function handleSuccess() {
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Gastos del edificio</h1>
          <p className="text-sm text-gray-500 mt-0.5">Total: <strong>{formatCurrency(total)}</strong></p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setOpen(true)}>+ Registrar gasto</Button>
        )}
      </div>

      {expenses.length === 0 ? (
        <Card>
          <p className="text-sm text-gray-500 text-center py-4">No hay gastos registrados.</p>
        </Card>
      ) : (
        <Card padding={false}>
          <div className="divide-y divide-gray-50">
            {expenses.map((e) => (
              <div key={e.id} className="flex items-center justify-between px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate">{e.description}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">{formatDate(e.date)}</span>
                    <Badge variant={CATEGORY_COLORS[e.category] ?? "gray"}>{e.category}</Badge>
                  </div>
                </div>
                <span className="text-sm font-semibold text-red-600 ml-3 flex-shrink-0">
                  {formatCurrency(e.amount)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {isAdmin && (
        <Modal open={open} onClose={() => setOpen(false)} title="Registrar gasto">
          <ExpenseForm onSuccess={handleSuccess} />
        </Modal>
      )}
    </div>
  );
}
