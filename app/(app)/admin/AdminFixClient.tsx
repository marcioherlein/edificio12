"use client";
import { useState } from "react";

interface Result {
  ok?: boolean;
  error?: string;
  [key: string]: unknown;
}

function FixButton({
  label, description, endpoint, onDone,
}: {
  label: string;
  description: string;
  endpoint: string;
  onDone: (r: Result) => void;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<Result | null>(null);

  async function run() {
    setStatus("loading");
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json();
      setResult(data);
      setStatus(data.ok ? "done" : "error");
      onDone(data);
    } catch (e: any) {
      setResult({ error: e.message });
      setStatus("error");
    }
  }

  return (
    <div className="bg-white border rounded p-5 space-y-3"
      style={{ borderColor: "var(--fiori-border)" }}>
      <div>
        <p className="text-sm font-bold" style={{ color: "var(--fiori-text)" }}>{label}</p>
        <p className="text-xs mt-0.5" style={{ color: "var(--fiori-text-muted)" }}>{description}</p>
      </div>

      {status === "idle" && (
        <button onClick={run}
          className="px-4 py-2 text-sm font-semibold text-white rounded transition-colors"
          style={{ background: "var(--fiori-blue)" }}>
          Aplicar
        </button>
      )}
      {status === "loading" && (
        <p className="text-sm" style={{ color: "var(--fiori-text-muted)" }}>Aplicando…</p>
      )}
      {status === "done" && (
        <div className="space-y-1">
          <p className="text-sm font-semibold" style={{ color: "var(--fiori-success)" }}>✓ Aplicado correctamente</p>
          <pre className="text-xs rounded p-2 overflow-x-auto"
            style={{ background: "#f5f6f7", color: "var(--fiori-text-muted)" }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
      {status === "error" && (
        <div className="space-y-1">
          <p className="text-sm font-semibold" style={{ color: "var(--fiori-error)" }}>Error</p>
          <pre className="text-xs rounded p-2 overflow-x-auto"
            style={{ background: "#fdf2f2", color: "var(--fiori-error)" }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function AdminFixClient() {
  const [log, setLog] = useState<{ label: string; result: Result }[]>([]);

  return (
    <div className="max-w-2xl mx-auto px-4 pt-8 pb-24 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--fiori-text)" }}>Correcciones de datos</h1>
        <p className="text-sm mt-1" style={{ color: "var(--fiori-text-muted)" }}>
          Cada corrección es idempotente — se puede aplicar más de una vez sin problema.
        </p>
      </div>

      <FixButton
        label="1. Corregir Walter (1B) — Marzo y Abril"
        description={
          "Elimina el pago de $35.000 mal atribuido a Marzo (fecha abril). " +
          "Fija el saldo de apertura de Abril en $70.000. " +
          "Agrega el pago real de $105.000 en Abril (cubre Feb + Mar + Abr)."
        }
        endpoint="/api/admin/fix-walter"
        onDone={(r) => setLog(l => [...l, { label: "fix-walter", result: r }])}
      />

      <FixButton
        label="2. Intereses Uala Marzo — $7.422,55"
        description={
          "Registra los intereses Uala de Marzo ($7.422,55) y ajusta el saldo de apertura bancario de Abril."
        }
        endpoint="/api/admin/fix-march-interest"
        onDone={(r) => setLog(l => [...l, { label: "fix-march-interest", result: r }])}
      />

      {log.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--fiori-text-muted)" }}>Log</p>
          {log.map((entry, i) => (
            <pre key={i} className="text-xs rounded p-3 overflow-x-auto"
              style={{ background: "#f5f6f7", color: "var(--fiori-text)" }}>
              {entry.label}: {JSON.stringify(entry.result, null, 2)}
            </pre>
          ))}
        </div>
      )}
    </div>
  );
}
