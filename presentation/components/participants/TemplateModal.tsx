"use client";

import { useEffect, useState } from "react";
import { Button } from "@/presentation/components/ui/Button";
import { Input } from "@/presentation/components/ui/Input";

type TemplateParticipant = { id: string; name: string; userId: string | null };

type BillTemplate = {
  id: string;
  name: string;
  currency: string;
  createdAt: string;
  participants: TemplateParticipant[];
};

type Props = {
  mode: "load" | "save";
  // For save mode:
  currentParticipants?: Array<{ name: string; userId?: string | null }>;
  currentCurrency?: string;
  // For load mode:
  onLoad?: (participants: TemplateParticipant[]) => void;
  onClose: () => void;
};

export function TemplateModal({ mode, currentParticipants, currentCurrency, onLoad, onClose }: Props) {
  const [templates, setTemplates] = useState<BillTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Save mode state
  const [templateName, setTemplateName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((j) => { if (j.success) setTemplates(j.data); })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!templateName.trim() || !currentParticipants?.length) return;
    setSaving(true);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName.trim(),
          currency: currentCurrency ?? "USD",
          participants: currentParticipants.map((p) => ({ name: p.name, userId: p.userId ?? null })),
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed to save template");
      setSaved(true);
      // Refresh list
      fetch("/api/templates")
        .then((r) => r.json())
        .then((j) => { if (j.success) setTemplates(j.data); })
        .catch(() => null);
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await fetch(`/api/templates/${id}`, { method: "DELETE" });
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="template-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-4 max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between">
          <h2 id="template-modal-title" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {mode === "save" ? "Save as Template" : "Load Template"}
          </h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-lg leading-none">✕</button>
        </div>

        {/* Save form */}
        {mode === "save" && (
          <div className="flex flex-col gap-3">
            {saved ? (
              <p className="text-sm text-green-600 dark:text-green-400 font-medium">✓ Template saved!</p>
            ) : (
              <>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Saving {currentParticipants?.length ?? 0} participant{(currentParticipants?.length ?? 0) !== 1 ? "s" : ""}.
                </p>
                <Input
                  placeholder="Template name (e.g. Roommates, Lunch Crew)"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                  autoFocus
                />
                <Button onClick={handleSave} loading={saving} disabled={!templateName.trim()}>
                  Save
                </Button>
              </>
            )}
          </div>
        )}

        {/* Divider / heading for existing templates */}
        {(mode === "load" || saved) && (
          <>
            {mode === "save" && saved && (
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Your Templates</p>
            )}
            <div className="overflow-y-auto flex-1 flex flex-col gap-2">
              {loading ? (
                <div className="flex justify-center py-6">
                  <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : templates.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No templates saved yet.</p>
              ) : (
                templates.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{t.name}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {t.currency} · {t.participants.map((p) => p.name).join(", ")}
                      </p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      {mode === "load" && (
                        <button
                          onClick={() => { onLoad?.(t.participants); onClose(); }}
                          className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Load
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(t.id)}
                        disabled={deletingId === t.id}
                        className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
                      >
                        {deletingId === t.id ? "…" : "Delete"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
