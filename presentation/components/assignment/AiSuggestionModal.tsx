"use client";

import { useState, useEffect } from "react";
import type { ParticipantDto, BillItemDto } from "@/application/dtos/index";
import { getParticipantColor } from "@/presentation/store/selectors/billSelectors";
import { Button } from "@/presentation/components/ui/Button";

export type AiSuggestion = {
  itemId: string;
  participantIds: string[];
  mode: "equally";
};

type Props = {
  suggestions: AiSuggestion[];
  reasoning: string;
  items: BillItemDto[];
  participants: ParticipantDto[];
  onApply: (selected: AiSuggestion[]) => Promise<void>;
  onClose: () => void;
};

export function AiSuggestionModal({ suggestions, reasoning, items, participants, onApply, onClose }: Props) {
  const [checked, setChecked] = useState<Set<string>>(() => new Set(suggestions.map((s) => s.itemId)));
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState<string | null>(null); // itemId being applied individually
  const [applyingAll, setApplyingAll] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const participantMap = new Map(participants.map((p, i) => [p.id, { name: p.name, color: getParticipantColor(i) }]));
  const itemMap = new Map(items.map((i) => [i.id, i]));

  function toggle(itemId: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  async function applyOne(suggestion: AiSuggestion) {
    setApplying(suggestion.itemId);
    try {
      await onApply([suggestion]);
      setAppliedIds((prev) => new Set([...prev, suggestion.itemId]));
    } finally {
      setApplying(null);
    }
  }

  async function applySelected() {
    const selected = suggestions.filter((s) => checked.has(s.itemId) && !appliedIds.has(s.itemId));
    if (selected.length === 0) return;
    setApplyingAll(true);
    try {
      await onApply(selected);
      setAppliedIds((prev) => new Set([...prev, ...selected.map((s) => s.itemId)]));
    } finally {
      setApplyingAll(false);
    }
  }

  const unappliedChecked = suggestions.filter((s) => checked.has(s.itemId) && !appliedIds.has(s.itemId)).length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg p-6 flex flex-col gap-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg" aria-hidden="true">✨</span>
            <h2 id="ai-modal-title" className="text-lg font-semibold text-slate-800 dark:text-slate-100">AI Assignment Suggestions</h2>
          </div>
          {reasoning && (
            <p className="text-sm text-slate-500 dark:text-slate-400 italic">{reasoning}</p>
          )}
        </div>

        {/* Suggestion rows */}
        <div className="overflow-y-auto flex-1 -mx-1 px-1 flex flex-col gap-2">
          {suggestions.map((s) => {
            const item = itemMap.get(s.itemId);
            if (!item) return null;
            const isApplied = appliedIds.has(s.itemId);
            const isApplying = applying === s.itemId;

            return (
              <div
                key={s.itemId}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                  isApplied
                    ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950"
                    : checked.has(s.itemId)
                    ? "border-blue-200 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/30"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                }`}
              >
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={checked.has(s.itemId)}
                  onChange={() => !isApplied && toggle(s.itemId)}
                  disabled={isApplied}
                  className="w-4 h-4 accent-blue-600 flex-shrink-0 cursor-pointer disabled:cursor-default"
                />

                {/* Item name */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                    {item.name}{item.quantity > 1 ? ` ×${item.quantity}` : ""}
                  </p>
                  {/* Participant chips */}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {s.participantIds.map((pid) => {
                      const p = participantMap.get(pid);
                      if (!p) return null;
                      return (
                        <span
                          key={pid}
                          className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${p.color}`} />
                          {p.name}
                        </span>
                      );
                    })}
                    <span className="text-xs text-slate-400 self-center">equally</span>
                  </div>
                </div>

                {/* Per-row apply / applied indicator */}
                {isApplied ? (
                  <span className="text-xs font-medium text-green-600 dark:text-green-400 flex-shrink-0">✓ Applied</span>
                ) : (
                  <button
                    onClick={() => applyOne(s)}
                    disabled={isApplying || applyingAll}
                    className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex-shrink-0 disabled:opacity-50"
                  >
                    {isApplying ? "…" : "Apply"}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex gap-3 pt-2 border-t border-slate-100 dark:border-slate-700">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Dismiss
          </Button>
          <Button
            className="flex-1"
            loading={applyingAll}
            disabled={unappliedChecked === 0 || applyingAll}
            onClick={applySelected}
          >
            Apply Selected ({unappliedChecked})
          </Button>
        </div>
      </div>
    </div>
  );
}
