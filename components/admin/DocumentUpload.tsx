"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import { formatMonthLabel } from "@/lib/utils";

const DOC_TYPES = ["Acta", "Liquidación", "Presupuesto", "Reglamento", "Circular", "Otro"];

function buildMonthOptions(): string[] {
  const options: string[] = [];
  const start = new Date(2025, 11, 1); // December 2025
  const end = new Date(2026, 11, 1);   // December 2026
  for (let d = new Date(end); d >= start; d.setMonth(d.getMonth() - 1)) {
    options.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return options;
}

interface Props { onSuccess: () => void; }

export default function DocumentUpload({ onSuccess }: Props) {
  const supabase = createClient();
  const [title, setTitle]   = useState("");
  const [type, setType]     = useState("");
  const [month, setMonth]   = useState("");
  const [file, setFile]     = useState<File | null>(null);
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const allMonths = buildMonthOptions();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!file || !title || !type) {
      setError("Completá todos los campos obligatorios.");
      return;
    }
    setLoading(true);

    const ext = file.name.split(".").pop();
    const filename = `${Date.now()}-${title.toLowerCase().replace(/\s+/g, "-")}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filename, file);

    if (uploadError) {
      setError("Error al subir el archivo: " + uploadError.message);
      setLoading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from("documents").getPublicUrl(filename);

    const { error: dbError } = await supabase.from("documents").insert({
      title,
      type,
      month: month || null,
      file_url: publicUrl,
    });

    if (dbError) {
      setError("Error al guardar el documento: " + dbError.message);
      setLoading(false);
      return;
    }

    onSuccess();
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
        <input
          type="text"
          required
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Ej: Acta Asamblea Marzo 2026"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
          <select
            required
            value={type}
            onChange={e => setType(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Seleccioná un tipo</option>
            {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Mes <span className="font-normal text-gray-400">(opcional)</span>
          </label>
          <select
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Sin mes específico</option>
            {allMonths.map(m => <option key={m} value={m}>{formatMonthLabel(m)}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Archivo *</label>
        <input
          type="file"
          required
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
          onChange={e => setFile(e.target.files?.[0] ?? null)}
          className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-colors"
        />
        <p className="text-xs text-gray-400 mt-1">PDF, Word, Excel, imágenes</p>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <div className="flex justify-end pt-1">
        <Button type="submit" loading={loading}>Subir documento</Button>
      </div>
    </form>
  );
}
