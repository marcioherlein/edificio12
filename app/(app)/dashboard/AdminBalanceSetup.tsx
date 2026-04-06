"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";

interface Props {
  month: string;
  /** If already set, pass current values so the form pre-fills */
  current?: { cash: number; bank: number };
}

export default function AdminBalanceSetup({ month, current }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [editing, setEditing] = useState(!current);
  const [cash, setCash] = useState(current ? String(current.cash) : "");
  const [bank, setBank] = useState(current ? String(current.bank) : "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setError("");
    if (!cash && !bank) { setError("Ingresá al menos un saldo."); return; }
    setLoading(true);
    const { error: err } = await supabase.from("account_balances").upsert({
      month,
      cash_opening: parseFloat(cash || "0"),
      bank_opening: parseFloat(bank || "0"),
    });
    if (err) {
      setError("Error: " + err.message);
    } else {
      setEditing(false);
      router.refresh();
    }
    setLoading(false);
  }

  // Already set and not editing — show compact summary with edit button
  if (current && !editing) {
    return (
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500 space-y-0.5">
          <p>Caja apertura: <span className="font-semibold text-gray-700">{formatCurrency(current.cash)}</span></p>
          <p>Uala apertura: <span className="font-semibold text-gray-700">{formatCurrency(current.bank)}</span></p>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-blue-600 hover:text-blue-700 border border-blue-200 rounded-lg px-3 py-1.5 bg-blue-50 transition-colors"
        >
          ✏️ Editar apertura
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-orange-700 mb-1">Saldo apertura — Caja (efectivo)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={cash}
            onChange={(e) => setCash(e.target.value)}
            placeholder="0.00"
            className="w-full px-2.5 py-1.5 border border-orange-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-orange-700 mb-1">Saldo apertura — Cta. Ualá</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={bank}
            onChange={(e) => setBank(e.target.value)}
            placeholder="0.00"
            className="w-full px-2.5 py-1.5 border border-orange-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
          />
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        {current && (
          <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
        )}
        <Button size="sm" onClick={handleSave} loading={loading} variant="secondary">
          Guardar saldo inicial
        </Button>
      </div>
    </div>
  );
}
