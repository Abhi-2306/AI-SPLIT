"use client";

import type { BillDto } from "@/application/dtos/index";
import { ItemAssignmentRow } from "./ItemAssignmentRow";
import { ParticipantChip } from "@/presentation/components/participants/ParticipantChip";
import { getAssignedUnits, getTotalUnits } from "@/presentation/store/selectors/billSelectors";

type AssignmentMatrixProps = {
  bill: BillDto;
};

export function AssignmentMatrix({ bill }: AssignmentMatrixProps) {
  const totalUnits = getTotalUnits(bill);
  const assignedUnits = getAssignedUnits(bill);
  const progress = totalUnits === 0 ? 0 : (assignedUnits / totalUnits) * 100;

  return (
    <div className="flex flex-col gap-4">
      {/* Legend */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-slate-500 font-medium">Participants:</span>
        {bill.participants.map((p, idx) => (
          <ParticipantChip key={p.id} participant={p} index={idx} />
        ))}
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>Assignment progress</span>
          <span>{assignedUnits}/{totalUnits} items assigned</span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${progress === 100 ? "bg-green-500" : "bg-blue-500"}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Instruction */}
      <p className="text-xs text-slate-400">
        Click participant names to toggle who shares each item. Multiple people can share one item — cost splits equally.
      </p>

      {/* Item rows */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 px-5 py-2">
        {bill.items.map((item) => (
          <ItemAssignmentRow
            key={item.id}
            item={item}
            billId={bill.id}
            participants={bill.participants}
            currency={bill.currency}
          />
        ))}
      </div>
    </div>
  );
}
