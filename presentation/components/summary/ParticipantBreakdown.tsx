"use client";

import type { ParticipantSplitDto } from "@/application/dtos/index";
import { formatAmount } from "@/lib/utils/currency";
import { getParticipantColor } from "@/presentation/store/selectors/billSelectors";

type ParticipantBreakdownProps = {
  split: ParticipantSplitDto;
  index: number;
  currency: string;
  paidByParticipantId?: string | null;
};

export function ParticipantBreakdown({ split, index, currency, paidByParticipantId }: ParticipantBreakdownProps) {
  const colorClass = getParticipantColor(index);
  const initials = split.participant.name.slice(0, 2).toUpperCase();
  const isPayer = paidByParticipantId === split.participant.id;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 bg-slate-50 dark:bg-slate-800/50">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${colorClass}`}>
          {initials}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-slate-800 dark:text-slate-200">{split.participant.name}</p>
          <p className="text-xs text-slate-500">{split.itemShares.length} item(s)</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {formatAmount(split.total, currency)}
          </p>
          {isPayer ? (
            <p className="text-xs text-green-600 font-medium">paid the bill</p>
          ) : paidByParticipantId ? (
            <p className="text-xs text-orange-500 font-medium">owes payer</p>
          ) : (
            <p className="text-xs text-slate-500">total</p>
          )}
        </div>
      </div>

      {/* Item breakdown */}
      {split.itemShares.length > 0 && (
        <div className="px-5 py-3 flex flex-col gap-1">
          {split.itemShares.map((share) => (
            <div key={share.item.id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="text-slate-600 dark:text-slate-400">{share.item.name}</span>
                {share.item.splitConfig === null ? (
                  <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                    units: {share.assignedUnitIndices.map((i) => `#${i + 1}`).join(", ")}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded capitalize">
                    {share.item.splitConfig.mode.replace(/_/g, " ")}
                  </span>
                )}
              </div>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {formatAmount(share.amountOwed, currency)}
              </span>
            </div>
          ))}

          {/* Tax / Discount / Tip */}
          {(split.taxShare !== 0 || split.discountShare > 0 || split.tipShare > 0) && (
            <div className="border-t border-slate-100 dark:border-slate-700 pt-2 mt-1 flex flex-col gap-1">
              {split.taxShare !== 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Tax / fees share</span>
                  <span className="text-slate-600 dark:text-slate-400">{formatAmount(split.taxShare, currency)}</span>
                </div>
              )}
              {split.discountShare > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-green-600 dark:text-green-400">Discount share</span>
                  <span className="text-green-600 dark:text-green-400 font-medium">−{formatAmount(split.discountShare, currency)}</span>
                </div>
              )}
              {split.tipShare > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Tip share</span>
                  <span className="text-slate-600 dark:text-slate-400">{formatAmount(split.tipShare, currency)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
