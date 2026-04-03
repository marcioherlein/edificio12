"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import AnnouncementForm from "@/components/admin/AnnouncementForm";

interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string;
}

interface Props { announcements: Announcement[]; isAdmin: boolean; }

export default function AnnouncementsClient({ announcements, isAdmin }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  function handleSuccess() {
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-xl font-bold text-gray-900">Avisos</h1>
        {isAdmin && (
          <Button size="sm" onClick={() => setOpen(true)}>+ Nuevo aviso</Button>
        )}
      </div>

      {announcements.length === 0 ? (
        <Card>
          <p className="text-sm text-gray-500 text-center py-4">No hay avisos publicados.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <Card key={a.id}>
              <div
                className="cursor-pointer"
                onClick={() => setExpanded(expanded === a.id ? null : a.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{a.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(a.date)}</p>
                  </div>
                  <span className="text-gray-400 text-sm mt-0.5 flex-shrink-0">
                    {expanded === a.id ? "▲" : "▼"}
                  </span>
                </div>
                {expanded !== a.id && (
                  <p className="text-sm text-gray-600 mt-1.5 line-clamp-2">{a.content}</p>
                )}
              </div>
              {expanded === a.id && (
                <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{a.content}</p>
              )}
            </Card>
          ))}
        </div>
      )}

      {isAdmin && (
        <Modal open={open} onClose={() => setOpen(false)} title="Nuevo aviso">
          <AnnouncementForm onSuccess={handleSuccess} />
        </Modal>
      )}
    </div>
  );
}
