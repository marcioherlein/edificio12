"use client";
import { useState } from "react";
import { formatCurrency, formatMonthLabel } from "@/lib/utils";
import Button from "@/components/ui/Button";

interface Summary {
  total_in: number;
  total_out: number;
  cash_balance: number;
  bank_balance: number;
  fund: number;
  units_paid: number;
  units_total: number;
}

interface Props {
  month: string;
  reportHtml: string | null;
  summary: Summary | null;
  generatedAt: string | null;
  isAdmin: boolean;
}

export default function ReportViewer({ month, reportHtml, summary, generatedAt, isAdmin }: Props) {
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [published, setPublished] = useState(false);

  async function generate() {
    setGenerating(true);
    setError("");
    const res = await fetch("/api/reports/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month }),
    });
    if (res.ok) {
      window.location.reload();
    } else {
      const { error: e } = await res.json().catch(() => ({ error: "Error desconocido" }));
      setError(e ?? "Error al generar el reporte");
    }
    setGenerating(false);
  }

  async function publish() {
    setPublishing(true);
    setError("");
    const res = await fetch("/api/reports/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month }),
    });
    if (res.ok) {
      setPublished(true);
    } else {
      const { error: e } = await res.json().catch(() => ({ error: "Error desconocido" }));
      setError(e ?? "Error al publicar el reporte");
    }
    setPublishing(false);
  }

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reporte mensual</h1>
          <p className="text-sm text-gray-500">{formatMonthLabel(month)}</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={generate} loading={generating}>
              {reportHtml ? "♻️ Regenerar" : "Generar reporte"}
            </Button>
            {reportHtml && (
              <Button size="sm" onClick={publish} loading={publishing} disabled={published}>
                {published ? "✅ Publicado en Documentos" : "📥 Publicar reporte final"}
              </Button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {published && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
          ✅ Reporte final publicado en la pestaña <strong>Documentos</strong> como &quot;REPORTE FINAL MES {formatMonthLabel(month).toUpperCase()}&quot;.
        </div>
      )}

      {!reportHtml && !generating && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
          <p className="text-4xl mb-3">📄</p>
          <p className="text-gray-700 font-semibold mb-1">No hay reporte generado para {formatMonthLabel(month)}</p>
          <p className="text-gray-400 text-sm">
            {isAdmin
              ? "Hacé clic en \"Generar reporte\" para crear la liquidación del mes."
              : "El administrador aún no ha generado este reporte."}
          </p>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Ingresos", value: formatCurrency(summary.total_in), color: "text-green-600" },
            { label: "Egresos", value: formatCurrency(summary.total_out), color: "text-red-600" },
            { label: "Fondo final", value: formatCurrency(summary.fund), color: "text-blue-700 font-bold" },
            { label: "Pagaron", value: `${summary.units_paid} / ${summary.units_total}`, color: "text-gray-700" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
              <p className="text-xs text-gray-400 mb-0.5">{label}</p>
              <p className={`text-base font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {generatedAt && (
        <p className="text-xs text-gray-400 text-center">
          Generado: {new Date(generatedAt).toLocaleString("es-AR")}
        </p>
      )}

      {reportHtml && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Liquidación completa</span>
            <button
              onClick={() => {
                const w = window.open("", "_blank");
                if (w) { w.document.write(reportHtml); w.document.close(); }
              }}
              className="text-xs text-blue-600 hover:text-blue-700 transition-colors"
            >
              Abrir en nueva pestaña →
            </button>
          </div>
          <div
            className="p-4 overflow-auto"
            style={{ maxHeight: "70vh" }}
            dangerouslySetInnerHTML={{ __html: reportHtml }}
          />
        </div>
      )}
    </div>
  );
}
