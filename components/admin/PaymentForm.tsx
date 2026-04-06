"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import { currentMonth, formatMonthLabel } from "@/lib/utils";

function buildMonthOptions(): string[] {
  const options: string[] = [];
  const start = new Date(2025, 11, 1); // December 2025
  const end = new Date(2026, 11, 1);   // December 2026
  for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
    options.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return options; // Dec 2025 → Dec 2026 (oldest → newest)
}

interface Unit { id: string; name: string; }

interface Props {
  units: Unit[];
  onSuccess: (paymentId: string, isCash: boolean) => void;
  onCancel: () => void;
}

export default function PaymentForm({ units, onSuccess, onCancel }: Props) {
  const supabase = createClient();
  const cur = currentMonth();
  const allMonths = buildMonthOptions();

  const [unitId, setUnitId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"efectivo" | "transferencia">("efectivo");
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set([cur]));
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function toggleMonth(m: string) {
    setSelectedMonths(prev => {
      const next = new Set(prev);
      if (next.has(m)) {
        if (next.size > 1) next.delete(m); // at least one must stay selected
      } else {
        next.add(m);
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!unitId || !amount) { setError("Completá todos los campos obligatorios."); return; }
    if (selectedMonths.size === 0) { setError("Seleccioná al menos un mes."); return; }
    setLoading(true);

    let receipt_url: string | null = null;

    // Upload transfer receipt if provided
    if (method === "transferencia" && receiptFile) {
      const ext = receiptFile.name.split(".").pop() ?? "pdf";
      const filename = `payment-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("receipts")
        .upload(filename, receiptFile);
      if (uploadErr) {
        setError("Error al subir el comprobante: " + uploadErr.message);
        setLoading(false);
        return;
      }
      const { data: { publicUrl } } = supabase.storage.from("receipts").getPublicUrl(filename);
      receipt_url = publicUrl;
    }

    // Insert one payment row per selected month
    const months = Array.from(selectedMonths).sort();
    const rows = months.map(m => ({
      unit_id: unitId,
      amount: parseFloat(amount),
      method,
      month: m,
      date,
      notes: notes || null,
      receipt_url,
    }));

    const { data, error: insertErr } = await supabase
      .from("payments")
      .insert(rows)
      .select("id")

    if (insertErr) {
      setError("Error al registrar el pago: " + insertErr.message);
    } else {
      const firstId = data?.[0]?.id ?? "";
      onSuccess(firstId, method === "efectivo");
    }
    setLoading(false);
  }

  const monthsLabel = Array.from(selectedMonths).sort()
    .map(m => formatMonthLabel(m).split(" de ")[0]) // just "abril", "mayo"
    .join(", ");

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Unit */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Unidad *</label>
        <select
          required
          value={unitId}
          onChange={(e) => setUnitId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Seleccioná una unidad</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </div>

      {/* Amount */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Monto por mes *</label>
        <input
          type="number"
          required
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {selectedMonths.size > 1 && amount && (
          <p className="text-xs text-blue-600 mt-1">
            Se registrarán {selectedMonths.size} pagos de ${parseFloat(amount).toLocaleString("es-AR")} c/u
            — total ${(parseFloat(amount) * selectedMonths.size).toLocaleString("es-AR")}
          </p>
        )}
      </div>

      {/* Month checklist */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Meses que cubre este pago *
          {selectedMonths.size > 0 && (
            <span className="ml-2 text-blue-600 font-normal">{monthsLabel}</span>
          )}
        </label>
        <div className="border border-gray-200 rounded-lg overflow-hidden max-h-52 overflow-y-auto">
          {allMonths.map((m, idx) => {
            const checked = selectedMonths.has(m);
            const isCurrent = m === cur;
            return (
              <label
                key={m}
                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0 ${
                  checked ? "bg-blue-50" : idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                } hover:bg-blue-50`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleMonth(m)}
                  className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className={`text-sm ${checked ? "font-semibold text-blue-700" : "text-gray-700"}`}>
                  {formatMonthLabel(m)}
                </span>
                {isCurrent && (
                  <span className="text-xs text-blue-500 font-medium ml-auto">mes actual</span>
                )}
              </label>
            );
          })}
        </div>
      </div>

      {/* Method */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Método de pago *</label>
        <div className="flex gap-3">
          {(["efectivo", "transferencia"] as const).map((m) => (
            <label key={m} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border-2 cursor-pointer transition-colors ${
              method === m
                ? "border-blue-500 bg-blue-50 text-blue-700 font-medium"
                : "border-gray-200 text-gray-600 hover:border-gray-300"
            }`}>
              <input
                type="radio"
                name="payMethod"
                value={m}
                checked={method === m}
                onChange={() => setMethod(m)}
                className="sr-only"
              />
              <span>{m === "efectivo" ? "💵 Efectivo" : "🏦 Transferencia"}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Transfer receipt */}
      {method === "transferencia" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Comprobante de transferencia
          </label>
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>
      )}

      {method === "efectivo" && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
          <p className="text-xs text-amber-800">
            <strong>Efectivo:</strong> al guardar se genera un comprobante descargable para entregar al vecino.
          </p>
        </div>
      )}

      {/* Date + Notes */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fecha del pago</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Opcional"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" loading={loading}>
          Registrar {selectedMonths.size > 1 ? `${selectedMonths.size} pagos` : "pago"}
        </Button>
      </div>
    </form>
  );
}
