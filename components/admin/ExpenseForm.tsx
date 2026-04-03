"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";

interface Category { id: string; name: string; }

interface Props {
  categories: Category[];
  onSuccess: (expenseId: string, isCash: boolean) => void;
  onCancel: () => void;
}

export default function ExpenseForm({ categories, onSuccess, onCancel }: Props) {
  const supabase = createClient();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"efectivo" | "transferencia">("transferencia");
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const finalCategory = showCustom ? customCategory.trim() : category;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!description || !amount || !finalCategory) {
      setError("Completá todos los campos obligatorios.");
      return;
    }
    setLoading(true);

    let receipt_url: string | null = null;

    // For transfer: upload receipt file if provided
    if (method === "transferencia" && receiptFile) {
      const ext = receiptFile.name.split(".").pop() ?? "pdf";
      const filename = `expense-${Date.now()}.${ext}`;
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

    // Save custom category to DB if new
    if (showCustom && customCategory.trim()) {
      await supabase
        .from("expense_categories")
        .insert({ name: customCategory.trim() })
        .select()
        .single();
    }

    const { data, error: insertErr } = await supabase
      .from("expenses")
      .insert({
        description,
        amount: parseFloat(amount),
        category: finalCategory,
        method,
        date,
        receipt_url,
      })
      .select("id")
      .single();

    if (insertErr) {
      setError("Error al registrar el gasto: " + insertErr.message);
    } else {
      onSuccess(data.id, method === "efectivo");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción *</label>
        <input
          type="text"
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ej: Pago Edenor - Factura A nº 0001-00123456"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Categoría *</label>
        {!showCustom ? (
          <div className="flex gap-2">
            <select
              required={!showCustom}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccioná una categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => { setShowCustom(true); setCategory(""); }}
              className="text-xs text-blue-600 hover:text-blue-700 whitespace-nowrap px-2"
            >
              + Nueva
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              required
              autoFocus
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              placeholder="Nombre de la nueva categoría"
              className="flex-1 px-3 py-2 border border-blue-400 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => { setShowCustom(false); setCustomCategory(""); }}
              className="text-xs text-gray-500 hover:text-gray-700 px-2"
            >
              Cancelar
            </button>
          </div>
        )}
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Método de pago *</label>
        <div className="flex gap-3">
          {(["transferencia", "efectivo"] as const).map((m) => (
            <label key={m} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border-2 cursor-pointer transition-colors ${
              method === m
                ? "border-blue-500 bg-blue-50 text-blue-700 font-medium"
                : "border-gray-200 text-gray-600 hover:border-gray-300"
            }`}>
              <input
                type="radio"
                name="method"
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Comprobante de transferencia</label>
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          <p className="text-xs text-gray-400 mt-1">JPG, PNG o PDF. Se guarda para consulta de vecinos.</p>
        </div>
      )}

      {/* Cash: explain what happens */}
      {method === "efectivo" && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
          <p className="text-xs text-amber-800">
            <strong>Pago en efectivo:</strong> al guardar se generará automáticamente un comprobante descargable y se actualizará el balance de Caja.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" loading={loading}>Registrar gasto</Button>
      </div>
    </form>
  );
}
