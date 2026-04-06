"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import DocumentUpload from "@/components/admin/DocumentUpload";

interface Document {
  id: string;
  title: string;
  file_url: string;
  type: string;
  created_at: string;
}

interface Props { documents: Document[]; isAdmin: boolean; }

const TYPE_ICONS: Record<string, string> = {
  Acta: "📋", Liquidación: "💰", Presupuesto: "📐",
  Reglamento: "📜", Circular: "📬", Reporte: "📊", Otro: "📄",
};

export default function DocumentsClient({ documents, isAdmin }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function handleSuccess() {
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-xl font-bold text-gray-900">Documentos</h1>
        {isAdmin && (
          <Button size="sm" onClick={() => setOpen(true)}>+ Subir documento</Button>
        )}
      </div>

      {documents.length === 0 ? (
        <Card>
          <p className="text-sm text-gray-500 text-center py-4">No hay documentos disponibles.</p>
        </Card>
      ) : (
        <Card padding={false}>
          <div className="divide-y divide-gray-50">
            {documents.map((doc) => (
              <a
                key={doc.id}
                href={doc.file_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors"
              >
                <span className="text-2xl flex-shrink-0">{TYPE_ICONS[doc.type] ?? "📄"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{doc.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="gray">{doc.type}</Badge>
                    <span className="text-xs text-gray-400">
                      {new Date(doc.created_at).toLocaleDateString("es-AR")}
                    </span>
                    {doc.type === "Reporte" && (
                      <span className="text-xs text-blue-600 font-medium">✍️ Fabiana Herlein</span>
                    )}
                  </div>
                </div>
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </a>
            ))}
          </div>
        </Card>
      )}

      {isAdmin && (
        <Modal open={open} onClose={() => setOpen(false)} title="Subir documento">
          <DocumentUpload onSuccess={handleSuccess} />
        </Modal>
      )}
    </div>
  );
}
