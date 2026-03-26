"use client";

import { useState, useRef, useEffect } from "react";
import type { ParticipantDto } from "@/application/dtos/index";
import { getParticipantColor } from "@/presentation/store/selectors/billSelectors";
import { useBillStore } from "@/presentation/store/billStore";
import { useUiStore } from "@/presentation/store/uiStore";

type ParticipantChipProps = {
  participant: ParticipantDto;
  index: number;
  billId: string;
  onRemove?: () => void;
};

export function ParticipantChip({ participant, index, billId, onRemove }: ParticipantChipProps) {
  const colorClass = getParticipantColor(index);
  const { updateParticipant } = useBillStore();
  const { addToast } = useUiStore();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(participant.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  async function saveEdit() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === participant.name) {
      setName(participant.name);
      setEditing(false);
      return;
    }
    try {
      await updateParticipant(billId, participant.id, trimmed);
      setEditing(false);
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : "Failed to rename", "error");
      setName(participant.name);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900 border border-blue-300 dark:border-blue-600 text-sm font-medium">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${colorClass}`} />
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveEdit();
            if (e.key === "Escape") { setName(participant.name); setEditing(false); }
          }}
          className="bg-transparent outline-none w-24 text-slate-800 dark:text-slate-100"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-700 text-sm font-medium group">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${colorClass}`} />
      <button
        onClick={() => setEditing(true)}
        className="text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        title={`Rename ${participant.name}`}
      >
        {participant.name}
      </button>
      {onRemove && (
        <button
          onClick={onRemove}
          className="text-slate-400 hover:text-red-500 transition-colors ml-1 opacity-0 group-hover:opacity-100"
          title={`Remove ${participant.name}`}
        >
          ×
        </button>
      )}
    </div>
  );
}
