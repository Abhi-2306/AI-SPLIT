"use client";

import { useState, useEffect, useCallback } from "react";
import type { BillDto } from "@/application/dtos/index";
import { ItemAssignmentRow } from "./ItemAssignmentRow";
import { getAssignedUnits, getTotalUnits, getParticipantColor } from "@/presentation/store/selectors/billSelectors";
import { useBillStore } from "@/presentation/store/billStore";
import { useUiStore } from "@/presentation/store/uiStore";
import { AiSuggestionModal, type AiSuggestion } from "./AiSuggestionModal";

type AssignmentMatrixProps = {
  bill: BillDto;
};

type AiUsage = { used: number; limit: number; remaining: number };
type PatternSuggestion = { suggestedMode: string | null; confidence: number };

export function AssignmentMatrix({ bill }: AssignmentMatrixProps) {
  const totalUnits = getTotalUnits(bill);
  const assignedUnits = getAssignedUnits(bill);
  const progress = totalUnits === 0 ? 0 : (assignedUnits / totalUnits) * 100;

  const { setItemSplitConfig } = useBillStore();
  const { addToast } = useUiStore();

  // AI Suggest state
  const [aiUsage, setAiUsage] = useState<AiUsage | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [suggestions, setSuggestions] = useState<{ items: AiSuggestion[]; reasoning: string } | null>(null);

  // Pattern suggestion state
  const [pattern, setPattern] = useState<PatternSuggestion | null>(null);
  const [patternDismissed, setPatternDismissed] = useState(false);
  const [applyingPattern, setApplyingPattern] = useState(false);

  useEffect(() => {
    fetch("/api/ai-usage")
      .then((r) => r.json())
      .then((j) => { if (j.success) setAiUsage(j.data); })
      .catch(() => null);

    fetch(`/api/bills/${bill.id}/suggest-patterns`)
      .then((r) => r.json())
      .then((j) => { if (j.success) setPattern(j.data); })
      .catch(() => null);
  }, [bill.id]);

  async function handleAiSuggest() {
    if (loadingAi) return;
    setLoadingAi(true);
    try {
      const res = await fetch(`/api/bills/${bill.id}/ai-suggest`, { method: "POST" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "AI suggestion failed");
      setSuggestions({ items: json.data.suggestions, reasoning: json.data.reasoning });
      setAiUsage((prev) => prev ? { ...prev, used: prev.used + 1, remaining: Math.max(0, prev.remaining - 1) } : prev);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "AI suggestion failed", "error");
    } finally {
      setLoadingAi(false);
    }
  }

  const applyAiSuggestions = useCallback(async (selected: AiSuggestion[]) => {
    await Promise.all(
      selected.map((s) =>
        setItemSplitConfig(bill.id, s.itemId, {
          mode: s.mode,
          entries: s.participantIds.map((pid) => ({ participantId: pid, value: 1 })),
        })
      )
    );
  }, [bill.id, setItemSplitConfig]);

  async function handleApplyPattern() {
    if (!pattern?.suggestedMode) return;
    setApplyingPattern(true);
    try {
      const allParticipantIds = bill.participants.map((p) => p.id);
      await Promise.all(
        bill.items.map((item) =>
          setItemSplitConfig(bill.id, item.id, {
            mode: pattern.suggestedMode!,
            entries: allParticipantIds.map((pid) => ({ participantId: pid, value: 1 })),
          })
        )
      );
      setPatternDismissed(true);
    } catch {
      addToast("Failed to apply pattern", "error");
    } finally {
      setApplyingPattern(false);
    }
  }

  const linkedParticipants = bill.participants.filter((p) => p.userId);
  const showPattern =
    !patternDismissed &&
    pattern?.suggestedMode !== null &&
    (pattern?.confidence ?? 0) >= 2 &&
    linkedParticipants.length >= 2;

  return (
    <div className="flex flex-col gap-4">
      {/* AI Suggest button row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-slate-500 font-medium">Participants:</span>
          {bill.participants.map((p, idx) => (
            <div key={p.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-700 text-sm font-medium">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getParticipantColor(idx)}`} />
              <span className="text-slate-700 dark:text-slate-200">{p.name}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
          <button
            onClick={handleAiSuggest}
            disabled={loadingAi || (aiUsage?.remaining === 0)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingAi ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Thinking…
              </span>
            ) : (
              <>✨ AI Suggest</>
            )}
          </button>
          {aiUsage && (
            <span className="text-xs text-slate-400">
              {aiUsage.remaining === 999 ? "Unlimited" : `${aiUsage.remaining}/${aiUsage.limit} left today`}
            </span>
          )}
        </div>
      </div>

      {/* Pattern suggestion banner */}
      {showPattern && (
        <div className="flex items-center justify-between gap-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            ℹ️ You&apos;ve split <strong>{pattern!.suggestedMode}</strong> with this group in{" "}
            {pattern!.confidence} past bill{pattern!.confidence !== 1 ? "s" : ""}. Apply to all items?
          </p>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={handleApplyPattern}
              disabled={applyingPattern}
              className="text-xs font-medium text-blue-700 dark:text-blue-300 hover:underline disabled:opacity-50"
            >
              {applyingPattern ? "Applying…" : "Apply"}
            </button>
            <button
              onClick={() => setPatternDismissed(true)}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

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

      {/* AI Suggestion Modal */}
      {suggestions && (
        <AiSuggestionModal
          suggestions={suggestions.items}
          reasoning={suggestions.reasoning}
          items={bill.items}
          participants={bill.participants}
          onApply={applyAiSuggestions}
          onClose={() => setSuggestions(null)}
        />
      )}
    </div>
  );
}
