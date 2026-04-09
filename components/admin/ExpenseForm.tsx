"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import { currentMonth, formatMonthLabel, formatCurrency } from "@/lib/utils";

function getAllowedWindow(): { minDate: string; maxDate: string; currentMonth: string; graceMonth: string | null } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed

  const firstOfMonth = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const curMonth = `${y}-${String(m + 1).padStart(2, "0")}`;

  const graceY = m === 11 ? y + 1 : y;
  const graceM = m === 11 ? 1 : m + 2;
  const maxDate = `${graceY}-${String(graceM).padStart(2, "0")}-05`;

  const today = now.getDate();
  const isGracePeriod = now.getMonth() > m || (today <= 5 && now.getMonth() === m + 1);
  const graceMonth = isGracePeriod ? curMonth : null;

  return { minDate: firstOfMonth, maxDate, currentMonth: curMonth, graceMonth };
}

function formatDateDisplay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("es-AR", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

interface Category { id: string; name: string; }

interface Props {
  categories: Category[];
  onSuccess: (expenseId: string, isCash: boolean) => void;
  onCancel: () => void;
}

export default function ExpenseForm({ categories: initialCategories, onSuccess, onCancel }: Props) {
  const supabase = createClient();
  const { minDate, maxDate, graceMonth } = getAllowedWindow();

  const today = new Date().toISOString().split("T")[0];
  const defaultDate = today > maxDate ? maxDate : today < minDate ? minDate : today;

  // Live category list (grows if user adds a new one)
  const [categories, setCategories] = useState<Category[]>(initialCategories);

  const [description, setDescription] = useState("");
  const [amount, setAmount]           = useState("");
  const [method, setMethod]           = useState<"efectivo" | "transferencia">("transferencia");
  const [category, setCategory]       = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [showCustom, setShowCustom]   = useState(false);
  const [notes, setNotes]             = useState("");
  const [date, setDate]               = useState(defaultDate);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [error, setError]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [confirming, setConfirming]   = useState(false);

  const finalCategory = showCustom ? customCategory.trim() : category;

  function handleReview(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!description || !amount || !finalCategory) {
      setError("Completá todos los campos obligatorios.");
      return;
    }
    if (date < minDate || date > maxDate) {
      setError(`Solo podés registrar gastos entre el ${formatDateDisplay(minDate)} y el ${formatDateDisplay(maxDate)}.`);
      return;
    }
    setConfirming(true);
  }

  async function handleConfirm() {
    setError("");
    setLoading(true);

    let receipt_url: string | null = null;

    if (method === "transferencia" && receiptFile) {
      const ext = receiptFile.name.split(".").pop() ?? "pdf";
      const filename = `expense-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("receipts").upload(filename, receiptFile);
      if (uploadErr) {
        setError("Error al subir el comprobante: " + uploadErr.message);
        setLoading(false);
        setConfirming(false);
        return;
      }
      const { data: { publicUrl } } = supabase.storage.from("receipts").getPublicUrl(filename);
      receipt_url = publicUrl;
    }

    // Insert new category if custom, and add it to the live list
    if (showCustom && customCategory.trim()) {
      const { data: newCat } = await supabase
        .from("expense_categories")
        .insert({ name: customCategory.trim() })
        .select("id, name")
        .single();
      if (newCat) {
        setCategories(prev => [...prev, newCat].sort((a, b) => a.name.localeCompare(b.name)));
      }
    }

    const { data, error: insertErr } = await supabase
      .from("expenses")
      .insert({
        description,
        amount: parseFloat(amount),
        category: finalCategory,
        method,
        date,
        notes: notes.trim() || null,
        receipt_url,
      })
      .select("id")
      .single();

    if (insertErr) {
      setError("Error al registrar el gasto: " + insertErr.message);
      setConfirming(false);
    } else {
      onSuccess(data.id, method === "efectivo");
    }
    setLoading(false);
  }

  // ── Confirmation screen ──────────────────────────────────────
  if (confirming) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">🔍</span>
          <h3 className="text-base font-bold text-gray-900">Confirmá el gasto antes de registrar</h3>
        </div>

        <div className="rounded-xl border-2 border-red-200 bg-red-50 overflow-hidden">
          <div className="bg-red-600 px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-red-200 font-medium uppercase tracking-widest">Descripción</p>
              <p className="text-lg font-bold text-white leading-tight">{description}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-red-200 font-medium uppercase tracking-widest">Monto</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(parseFloat(amount))}</p>
            </div>
          </div>

          <div className="divide-y divide-red-100">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-gray-500">Categoría</span>
              <span className="text-sm font-medium text-gray-800">{finalCategory}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-gray-500">Método</span>
              <span className="text-sm font-medium text-gray-800">
                {method === "efectivo" ? "💵 Efectivo" : "🏦 Transferencia"}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-gray-500">Fecha</span>
              <span className="text-sm font-medium text-gray-800">{formatDateDisplay(date)}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-gray-500">Se registra en</span>
              <span className="text-sm font-semibold text-gray-800">{formatMonthLabel(date.slice(0, 7))}</span>
            </div>
            {notes.trim() && (
              <div className="flex items-start justify-between px-4 py-3">
                <span className="text-sm text-gray-500">Notas</span>
                <span className="text-sm text-gray-700 italic text-right max-w-[60%]">{notes}</span>
              </div>
            )}
            {method === "transferencia" && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-gray-500">Comprobante</span>
                <span className={`text-sm font-medium ${receiptFile ? "text-green-700" : "text-amber-600"}`}>
                  {receiptFile ? `📎 ${receiptFile.name}` : "Sin adjunto"}
                </span>
              </div>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={() => setConfirming(false)}
            className="flex-1 px-4 py-2.5 text-sm font-semibold border-2 border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors">
            ← Corregir
          </button>
          <button type="button" onClick={handleConfirm} disabled={loading}
            className="flex-1 px-4 py-2.5 text-sm font-bold bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors">
            {loading ? "Registrando…" : "Confirmar gasto"}
          </button>
        </div>
      </div>
    );
  }

  // ── Form ────────────────────────────────────────────────────
  return (
    <form onSubmit={handleReview} className="space-y-4">

      {graceMonth && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg px-3 py-2.5">
          <p className="text-xs text-amber-800">
            <strong>Período de gracia:</strong> podés registrar gastos de{" "}
            <strong>{formatMonthLabel(graceMonth)}</strong> hasta el día 5 de este mes.
          </p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción *</label>
        <input type="text" required value={description} onChange={e => setDescription(e.target.value)}
          placeholder="Ej: Pago Edenor - Factura A nº 0001-00123456"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Categoría *</label>
        {!showCustom ? (
          <div className="flex gap-2">
            <select required value={category} onChange={e => setCategory(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Seleccioná una categoría</option>
              {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <button type="button"
              onClick={() => { setShowCustom(true); setCategory(""); }}
              className="flex items-center gap-1 text-xs font-bold text-white bg-[#0070f2] hover:bg-[#005ecb] px-3 py-2 rounded-lg whitespace-nowrap transition-colors">
              + Nueva
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input type="text" required autoFocus value={customCategory}
              onChange={e => setCustomCategory(e.target.value)}
              placeholder="Nombre de la nueva categoría"
              className="flex-1 px-3 py-2 border-2 border-blue-400 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button type="button" onClick={() => { setShowCustom(false); setCustomCategory(""); }}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 whitespace-nowrap">
              Cancelar
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Monto *</label>
          <input type="number" required min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fecha *
            <span className="ml-1 text-xs font-normal text-gray-400">
              (hasta día 5 del mes siguiente)
            </span>
          </label>
          <input type="date" required value={date} min={minDate} max={maxDate} onChange={e => setDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {/* Method */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Método de pago *</label>
        <div className="flex gap-3">
          {(["transferencia", "efectivo"] as const).map(m => (
            <label key={m} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border-2 cursor-pointer transition-colors ${
              method === m ? "border-blue-500 bg-blue-50 text-blue-700 font-medium" : "border-gray-200 text-gray-600 hover:border-gray-300"
            }`}>
              <input type="radio" name="method" value={m} checked={method === m} onChange={() => setMethod(m)} className="sr-only" />
              <span>{m === "efectivo" ? "💵 Efectivo" : "🏦 Transferencia"}</span>
            </label>
          ))}
        </div>
      </div>

      {method === "transferencia" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Comprobante</label>
          <input type="file" accept="image/*,.pdf" onChange={e => setReceiptFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
          <p className="text-xs text-gray-400 mt-1">JPG, PNG o PDF.</p>
        </div>
      )}

      {method === "efectivo" && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
          <p className="text-xs text-amber-800">
            <strong>Efectivo:</strong> al confirmar se genera un comprobante descargable.
          </p>
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notas <span className="font-normal text-gray-400">(opcional)</span></label>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Ej: Factura 0001-00123456, pago parcial, etc."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit">Revisar gasto →</Button>
      </div>
    </form>
  );
}
