"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import { useRouter } from "next/navigation";
import { formatCurrency, formatMonthLabel } from "@/lib/utils";

interface Props {
  month: string;
  /** Previous month label, e.g. "marzo de 2026" */
  prevMonthLabel: string;
  /** If the opening was already computed, pass the notes string (contains date) */
  openingNotes: string | null;
  /** Whether today is within the 5-day grace period (days 1-5 of month) */
  isGracePeriod: boolean;
  /** Current bank_interest value stored for this month */
  bankInterest: number;
}

export default function AdminBalanceSetup({
  month, prevMonthLabel, openingNotes, isGracePeriod, bankInterest,
}: Props) {
  const router    = useRouter();
  const supabase  = createClient();
  const openingSet = !!openingNotes;

  // ── Compute opening balance ──────────────────────────────────────────────────
  const [computing, setComputing]   = useState(false);
  const [computeError, setComputeError] = useState("");

  async function handleCompute() {
    setComputing(true);
    setComputeError("");
    const [prevY, prevM] = month.split("-").map(Number);
    const srcM = prevM === 1 ? 12 : prevM - 1;
    const srcY = prevM === 1 ? prevY - 1 : prevY;
    const sourceMonth = `${srcY}-${String(srcM).padStart(2, "0")}`;

    const res = await fetch("/api/months/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceMonth }),
    });
    if (res.ok) {
      router.refresh();
    } else {
      const { error: e } = await res.json().catch(() => ({ error: "Error desconocido" }));
      setComputeError(e ?? "Error al calcular la apertura");
    }
    setComputing(false);
  }

  // ── Bank interest update ─────────────────────────────────────────────────────
  const [interest, setInterest]       = useState(bankInterest > 0 ? String(bankInterest) : "");
  const [savingInt, setSavingInt]     = useState(false);
  const [interestSaved, setInterestSaved] = useState(false);

  async function handleSaveInterest() {
    setSavingInt(true);
    setInterestSaved(false);
    const { error } = await supabase
      .from("account_balances")
      .update({ bank_interest: parseFloat(interest || "0") })
      .eq("month", month);
    if (!error) {
      setInterestSaved(true);
      router.refresh();
    }
    setSavingInt(false);
  }

  // ── Extract computed-on date from notes ──────────────────────────────────────
  // notes format: "Auto-computed from 2026-03 on 2026-04-06"
  const computedOnDate = openingNotes?.match(/on (\d{4}-\d{2}-\d{2})/)?.[1] ?? null;

  return (
    <div className="space-y-3">

      {/* ── Opening balance section ── */}
      {!openingSet ? (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-orange-800">
              ⚠️ Apertura de {formatMonthLabel(month)} no calculada
            </p>
            <p className="text-xs text-orange-600 mt-1">
              El saldo de apertura se deriva automáticamente del cierre de {prevMonthLabel}.
            </p>
          </div>
          {isGracePeriod && (
            <p className="text-xs bg-amber-100 border border-amber-300 text-amber-800 rounded-lg px-3 py-2">
              ⏳ <strong>Período de gracia activo.</strong> Si vas a registrar movimientos de {prevMonthLabel}, hacelo primero y calculá la apertura después.
            </p>
          )}
          {computeError && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{computeError}</p>
          )}
          <Button size="sm" onClick={handleCompute} loading={computing} variant="secondary">
            Calcular apertura desde cierre de {prevMonthLabel}
          </Button>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            <span className="font-semibold text-gray-700">Apertura calculada</span>
            {computedOnDate && (
              <span> · {new Date(computedOnDate + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "long" })}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isGracePeriod && (
              <button
                onClick={handleCompute}
                disabled={computing}
                className="text-xs text-amber-600 hover:text-amber-700 font-medium transition-colors disabled:opacity-50"
              >
                {computing ? "Recalculando…" : "↺ Recalcular"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Bank interest section (only when opening is set) ── */}
      {openingSet && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-blue-700 mb-2">🏦 Intereses Ualá del mes</p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="0.01"
              value={interest}
              onChange={e => { setInterest(e.target.value); setInterestSaved(false); }}
              placeholder="0.00"
              className="w-40 px-2.5 py-1.5 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            />
            <Button size="sm" onClick={handleSaveInterest} loading={savingInt} variant="secondary">
              Guardar
            </Button>
            {interestSaved && <span className="text-xs text-green-600 font-medium">✓ Guardado</span>}
            {bankInterest > 0 && !interestSaved && (
              <span className="text-xs text-gray-500">Actual: {formatCurrency(bankInterest)}</span>
            )}
          </div>
          <p className="text-xs text-blue-500 mt-1.5">
            Ingresá el interés generado en la cuenta Ualá según el extracto bancario.
          </p>
        </div>
      )}
    </div>
  );
}
