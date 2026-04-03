"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import { useRouter } from "next/navigation";

interface Props { month: string; }

export default function AdminBalanceSetup({ month }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [cash, setCash] = useState("");
  const [bank, setBank] = useState("");
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
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-orange-700 mb-1">Saldo anterior — Caja (efectivo)</label>
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
          <label className="block text-xs font-medium text-orange-700 mb-1">Saldo anterior — Cta. Ualá</label>
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
      <Button size="sm" onClick={handleSave} loading={loading} variant="secondary">
        Guardar saldo inicial
      </Button>
    </div>
  );
}
