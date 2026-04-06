"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";

interface Props {
  month: string;
  bankInterest: number;
}

export default function AdminBalanceSetup({ month, bankInterest }: Props) {
  const router   = useRouter();
  const supabase = createClient();

  const [interest, setInterest]           = useState(bankInterest > 0 ? String(bankInterest) : "");
  const [saving, setSaving]               = useState(false);
  const [saved, setSaved]                 = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    const { error } = await supabase
      .from("account_balances")
      .update({ bank_interest: parseFloat(interest || "0") })
      .eq("month", month);
    if (!error) {
      setSaved(true);
      router.refresh();
    }
    setSaving(false);
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
      <p className="text-xs font-semibold text-blue-700 mb-2">🏦 Intereses Ualá del mes</p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min="0"
          step="0.01"
          value={interest}
          onChange={e => { setInterest(e.target.value); setSaved(false); }}
          placeholder="0.00"
          className="w-40 px-2.5 py-1.5 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
        />
        <Button size="sm" onClick={handleSave} loading={saving} variant="secondary">
          Guardar
        </Button>
        {saved && <span className="text-xs text-green-600 font-medium">✓ Guardado</span>}
        {bankInterest > 0 && !saved && (
          <span className="text-xs text-gray-500">Actual: {formatCurrency(bankInterest)}</span>
        )}
      </div>
      <p className="text-xs text-blue-500 mt-1.5">
        Ingresá el interés generado en la cuenta Ualá según el extracto bancario.
      </p>
    </div>
  );
}
