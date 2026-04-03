"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import { currentMonth } from "@/lib/utils";

interface Unit { id: string; name: string; }

interface Props {
  units: Unit[];
  onSuccess: (paymentId: string, isCash: boolean) => void;
  onCancel: () => void;
}

export default function PaymentForm({ units, onSuccess, onCancel }: Props) {
  const supabase = createClient();
  const [unitId, setUnitId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"efectivo" | "transferencia">("efectivo");
  const [month, setMonth] = useState(currentMonth());
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!unitId || !amount) { setError("Completá todos los campos obligatorios."); return; }
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

    const { data, error: insertErr } = await supabase
      .from("payments")
      .insert({
        unit_id: unitId,
        amount: parseFloat(amount),
        method,
        month,
        date,
        notes: notes || null,
        receipt_url,
      })
      .select("id")
      .single();

    if (insertErr) {
      setError("Error al registrar el pago: " + insertErr.message);
    } else {
      onSuccess(data.id, method === "efectivo");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Monto *</label>
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
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mes *</label>
          <input
            type="month"
            required
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

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

      {/* Transfer: upload receipt */}
      {method === "transferencia" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Comprobante de transferencia <span className="text-red-500">*</span>
          </label>
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>
      )}

      {/* Cash: explain auto-receipt */}
      {method === "efectivo" && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
          <p className="text-xs text-amber-800">
            <strong>Pago en efectivo:</strong> al guardar se genera un comprobante automático descargable para enviar al vecino y se suma al balance de Caja.
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
        <Button type="submit" loading={loading}>Registrar pago</Button>
      </div>
    </form>
  );
}
