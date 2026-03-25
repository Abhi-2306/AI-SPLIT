"use client";

import type { SplitResultDto, BillDto } from "@/application/dtos/index";
import { ParticipantBreakdown } from "./ParticipantBreakdown";
import { formatAmount } from "@/lib/utils/currency";

type SplitSummaryPanelProps = {
  splitResult: SplitResultDto;
  bill: BillDto;
};

export function SplitSummaryPanel({ splitResult, bill }: SplitSummaryPanelProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Overall totals */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-xs text-slate-500 mb-1">Bill Total</p>
          <p className="text-xl font-bold text-slate-800 dark:text-slate-200">
            {formatAmount(bill.total, bill.currency)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-xs text-slate-500 mb-1">Participants</p>
          <p className="text-xl font-bold text-slate-800 dark:text-slate-200">
            {bill.participants.length}
          </p>
        </div>
        <div className={`rounded-xl border p-4 ${splitResult.isComplete ? "border-green-300 bg-green-50 dark:bg-green-950" : "border-yellow-300 bg-yellow-50 dark:bg-yellow-950"}`}>
          <p className="text-xs text-slate-500 mb-1">Status</p>
          <p className={`text-xl font-bold ${splitResult.isComplete ? "text-green-600" : "text-yellow-600"}`}>
            {splitResult.isComplete ? "Complete ✓" : "Incomplete"}
          </p>
        </div>
      </div>

      {/* Unassigned warning */}
      {!splitResult.isComplete && splitResult.unassignedUnits.length > 0 && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-950 px-4 py-3">
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            ⚠️ {splitResult.unassignedUnits.length} unit(s) are not assigned yet
          </p>
          <ul className="mt-1 text-xs text-yellow-700 dark:text-yellow-300 flex flex-wrap gap-1">
            {splitResult.unassignedUnits.map((u, i) => (
              <li key={i} className="bg-yellow-100 dark:bg-yellow-900 px-2 py-0.5 rounded">
                {u.item.name} #{u.unitIndex + 1}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Per-person breakdown */}
      <div>
        <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-3">
          Per-Person Breakdown
        </h3>
        <div className="flex flex-col gap-3">
          {splitResult.participantSplits.map((split, idx) => (
            <ParticipantBreakdown
              key={split.participant.id}
              split={split}
              index={idx}
              currency={bill.currency}
              paidByParticipantId={bill.paidByParticipantId}
            />
          ))}
        </div>
      </div>

      {/* Settlements */}
      {splitResult.settlements.length > 0 && (
        <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 p-4">
          <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-3">Settlements</h3>
          <div className="flex flex-col gap-2">
            {splitResult.settlements.map((s, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-slate-700 dark:text-slate-300">
                  <span className="font-semibold">{s.from.name}</span>
                  {" → "}
                  <span className="font-semibold">{s.to.name}</span>
                </span>
                <span className="font-bold text-blue-700 dark:text-blue-300">
                  {formatAmount(s.amount, bill.currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
