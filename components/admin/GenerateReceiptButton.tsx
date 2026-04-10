"use client";
import { useState } from "react";

interface Props {
  paymentId: string;
  defaultName: string;
  existingPayerName?: string | null;
}

export default function GenerateReceiptButton({ paymentId, defaultName, existingPayerName }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(existingPayerName || defaultName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    if (!name.trim()) { setError("Ingresá el nombre completo."); return; }
    setError("");
    setLoading(true);
    const res = await fetch(`/api/receipts/${paymentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payer_name: name.trim() }),
    });
    setLoading(false);
    if (!res.ok) { setError("Error al guardar. Intentá de nuevo."); return; }
    setOpen(false);
    window.open(`/api/receipts/${paymentId}`, "_blank");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setName(existingPayerName || defaultName); setOpen(true); setError(""); }}
        className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded border transition-colors"
        style={{ color: "var(--fiori-warning)", borderColor: "var(--fiori-warning)", background: "#fffbeb" }}
      >
        🧾 Comprobante
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(15,23,42,0.5)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold" style={{ color: "var(--fiori-text)" }}>
                Generar comprobante
              </h3>
              <button onClick={() => setOpen(false)} className="text-sm px-1" style={{ color: "var(--fiori-text-muted)" }}>✕</button>
            </div>

            <p className="text-sm" style={{ color: "var(--fiori-text-muted)" }}>
              Ingresá el nombre completo de quien realizó el pago. Aparecerá en el comprobante como "Recibí de:".
            </p>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--fiori-text)" }}>
                Nombre y apellido *
              </label>
              <input
                type="text"
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleGenerate(); }}
                placeholder="Ej: Juan Carlos García"
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                style={{ borderColor: "var(--fiori-border)", color: "var(--fiori-text)" }}
              />
            </div>

            {error && (
              <p className="text-sm px-3 py-2 rounded" style={{ color: "var(--fiori-error)", background: "#fef2f2" }}>
                {error}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 px-3 py-2 text-sm border rounded-md"
                style={{ borderColor: "var(--fiori-border)", color: "var(--fiori-text-muted)" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading}
                className="flex-1 px-3 py-2 text-sm font-semibold text-white rounded-md disabled:opacity-50"
                style={{ background: "var(--fiori-warning)" }}
              >
                {loading ? "Guardando…" : existingPayerName ? "Regenerar" : "Generar"}
              </button>
            </div>

            <p className="text-xs text-center" style={{ color: "var(--fiori-text-muted)" }}>
              El comprobante se abrirá en una nueva pestaña listo para imprimir o guardar como PDF.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
