"use client";

import type { ParticipantDto } from "@/application/dtos/index";
import { getParticipantColor } from "@/presentation/store/selectors/billSelectors";

type QuantityAssignmentCellProps = {
  unitIndex: number;
  assignedParticipant: ParticipantDto | null;
  participants: ParticipantDto[];
  onAssign: (participantId: string) => void;
  onUnassign: () => void;
  disabled?: boolean;
};

/**
 * A single unit cell. Click cycles: Unassigned → P1 → P2 → ... → Unassigned.
 */
export function QuantityAssignmentCell({
  unitIndex,
  assignedParticipant,
  participants,
  onAssign,
  onUnassign,
  disabled = false,
}: QuantityAssignmentCellProps) {
  function handleClick() {
    if (disabled) return;
    if (!assignedParticipant) {
      // Assign to first participant
      if (participants.length > 0) onAssign(participants[0].id);
    } else {
      const currentIdx = participants.findIndex((p) => p.id === assignedParticipant.id);
      const nextIdx = currentIdx + 1;
      if (nextIdx >= participants.length) {
        onUnassign();
      } else {
        onAssign(participants[nextIdx].id);
      }
    }
  }

  const participantIndex = assignedParticipant
    ? participants.findIndex((p) => p.id === assignedParticipant.id)
    : -1;
  const colorClass =
    participantIndex >= 0 ? getParticipantColor(participantIndex) : "bg-slate-200 dark:bg-slate-700";

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      title={
        assignedParticipant
          ? `Unit #${unitIndex + 1}: ${assignedParticipant.name} (click to change)`
          : `Unit #${unitIndex + 1}: Unassigned (click to assign)`
      }
      className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold text-white transition-all shadow-sm hover:scale-105 active:scale-95 disabled:cursor-not-allowed ${colorClass} ${!assignedParticipant ? "text-slate-500 dark:text-slate-400" : ""}`}
    >
      {assignedParticipant
        ? assignedParticipant.name.slice(0, 2).toUpperCase()
        : `#${unitIndex + 1}`}
    </button>
  );
}
