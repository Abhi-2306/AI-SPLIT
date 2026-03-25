"use client";

import type { ParticipantDto } from "@/application/dtos/index";
import { getParticipantColor } from "@/presentation/store/selectors/billSelectors";

type ParticipantChipProps = {
  participant: ParticipantDto;
  index: number;
  onRemove?: () => void;
};

export function ParticipantChip({ participant, index, onRemove }: ParticipantChipProps) {
  const colorClass = getParticipantColor(index);

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-700 text-sm font-medium group">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${colorClass}`} />
      <span className="text-slate-700 dark:text-slate-200">{participant.name}</span>
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
