"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import { currentMonth, formatMonthLabel, formatCurrency, prevMonth, HIDDEN_MONTHS } from "@/lib/utils";

function buildMonthOptions(): string[] {
  const options: string[] = [];
  const start = new Date(2025, 11, 1); // December 2025
  const end = new Date(2026, 11, 1);   // December 2026
  for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!HIDDEN_MONTHS.has(m)) options.push(m);
  }
  }
  return options;
}

function formatDateDisplay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("es-AR", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

interface Unit { id: string; name: string; owner_name: string; }

interface Props {
  units: Unit[];
  onSuccess: (paymentId: string, isCash: boolean) => void;
  onCancel: () => void;
  defaultUnitId?: string;
}

export default function PaymentForm({ units, onSuccess, onCancel, defaultUnitId }: Props) {
  const supabase = createClient();
  const cur = currentMonth();
  const allMonths = buildMonthOptions();

  const [unitId, setUnitId] = useState(defaultUnitId ?? "");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"efectivo" | "transferencia">("efectivo");
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set([cur]));
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  function toggleMonth(m: string) {
    setSelectedMonths(prev => {
      const next = new Set(prev);
      if (next.has(m)) {
        if (next.size > 1) next.delete(m);
      } else {
        next.add(m);
      }
      return next;
    });
  }

  function handleReview(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!unitId || !amount) { setError("Completá todos los campos obligatorios."); return; }
    if (selectedMonths.size === 0) { setError("Seleccioná al menos un mes."); return; }
    setConfirming(true);
  }

  async function handleConfirm() {
    setError("");
    setLoading(true);

    const months = Array.from(selectedMonths).sort();

    // Block insert if any selected month's previous month is not closed,
    // or if the target month itself is already closed
    const prevMonths = [...new Set(months.map(prevMonth))];
    const { data: balanceRows } = await supabase
      .from("account_balances")
      .select("month, closed")
      .in("month", [...months, ...prevMonths]);
    const blockedPrev = months.filter(m => {
      const row = balanceRows?.find(r => r.month === prevMonth(m));
      return row && !row.closed;
    });
    const blockedClosed = months.filter(m =>
      balanceRows?.find(r => r.month === m)?.closed === true
    );
    if (blockedClosed.length > 0) {
      const labels = blockedClosed.map(m => formatMonthLabel(m)).join(", ");
      setError(`No se puede registrar: ${labels} ya está cerrado.`);
      setLoading(false);
      setConfirming(false);
      return;
    }
    if (blockedPrev.length > 0) {
      const labels = blockedPrev.map(m => formatMonthLabel(m)).join(", ");
      setError(`No se puede registrar: el mes anterior a ${labels} no está cerrado.`);
      setLoading(false);
      setConfirming(false);
      return;
    }

    let receipt_url: string | null = null;

    if (method === "transferencia" && receiptFile) {
      const ext = receiptFile.name.split(".").pop() ?? "pdf";
      const filename = `payment-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("receipts")
        .upload(filename, receiptFile);
      if (uploadErr) {
        setError("Error al subir el comprobante: " + uploadErr.message);
        setLoading(false);
        setConfirming(false);
        return;
      }
      const { data: { publicUrl } } = supabase.storage.from("receipts").getPublicUrl(filename);
      receipt_url = publicUrl;
    }

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
      .select("id");

    if (insertErr) {
      setError("Error al registrar el pago: " + insertErr.message);
      setConfirming(false);
    } else {
      onSuccess(data?.[0]?.id ?? "", method === "efectivo");
    }
    setLoading(false);
  }

  const unitName = units.find(u => u.id === unitId)?.name ?? "";
  const sortedSelectedMonths = Array.from(selectedMonths).sort();
  const totalAmount = parseFloat(amount || "0") * selectedMonths.size;

  // ── Confirmation screen ──────────────────────────────────────
  if (confirming) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">🔍</span>
          <h3 className="text-base font-bold text-gray-900">Confirmá los datos antes de registrar</h3>
        </div>

        {/* Summary card */}
        <div className="rounded-xl border-2 border-blue-200 bg-blue-50 overflow-hidden">
          {/* Unit + method header */}
          <div className="bg-blue-600 px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-200 font-medium uppercase tracking-widest">Unidad</p>
              <p className="text-2xl font-bold text-white">{unitName}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-blue-200 font-medium uppercase tracking-widest">Método</p>
              <p className="text-lg font-bold text-white">
                {method === "efectivo" ? "💵 Efectivo" : "🏦 Transferencia"}
              </p>
            </div>
          </div>

          {/* Details */}
          <div className="divide-y divide-blue-100">
            {/* Months + amounts */}
            {sortedSelectedMonths.map(m => (
              <div key={m} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm font-medium text-gray-700">{formatMonthLabel(m)}</span>
                <span className="text-base font-bold text-gray-900">{formatCurrency(parseFloat(amount))}</span>
              </div>
            ))}

            {/* Total if multiple months */}
            {selectedMonths.size > 1 && (
              <div className="flex items-center justify-between px-4 py-3 bg-blue-100/60">
                <span className="text-sm font-bold text-blue-800">
                  Total ({selectedMonths.size} meses)
                </span>
                <span className="text-lg font-bold text-blue-900">{formatCurrency(totalAmount)}</span>
              </div>
            )}

            {/* Date */}
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-gray-500">Fecha del pago</span>
              <span className="text-sm font-medium text-gray-800">{formatDateDisplay(date)}</span>
            </div>

            {/* Receipt */}
            {method === "transferencia" && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-gray-500">Comprobante</span>
                <span className={`text-sm font-medium ${receiptFile ? "text-green-700" : "text-amber-600"}`}>
                  {receiptFile ? `📎 ${receiptFile.name}` : "Sin adjunto"}
                </span>
              </div>
            )}

            {/* Notes */}
            {notes && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-gray-500">Notas</span>
                <span className="text-sm text-gray-700 italic">{notes}</span>
              </div>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="flex-1 px-4 py-2.5 text-sm font-semibold border-2 border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
          >
            ← Corregir
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2.5 text-sm font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Registrando…" : `Confirmar ${selectedMonths.size > 1 ? `${selectedMonths.size} pagos` : "pago"}`}
          </button>
        </div>
      </div>
    );
  }

  // ── Form ────────────────────────────────────────────────────
  return (
    <form onSubmit={handleReview} className="space-y-4">
      {/* Unit — hidden when pre-selected from a unit row */}
      {!defaultUnitId && (
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
              <option key={u.id} value={u.id}>{u.name} — {u.owner_name}</option>
            ))}
          </select>
        </div>
      )}

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
            {selectedMonths.size} meses × {formatCurrency(parseFloat(amount))} = <strong>{formatCurrency(totalAmount)}</strong> total
          </p>
        )}
      </div>

      {/* Month checklist */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Período que cubre este pago *
        </label>
        <p className="text-xs text-gray-400 mb-2">
          El pago se contabiliza en el mes en que se recibe. Indicá qué meses salda esta cobranza.
        </p>
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

      {method === "transferencia" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Comprobante</label>
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
            <strong>Efectivo:</strong> al confirmar se genera un comprobante descargable para entregar al vecino.
          </p>
        </div>
      )}

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
        <Button type="submit">
          Revisar pago →
        </Button>
      </div>
    </form>
  );
}
