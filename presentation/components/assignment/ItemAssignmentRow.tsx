"use client";

import { useState, useEffect } from "react";
import type { BillItemDto, ParticipantDto } from "@/application/dtos/index";
import { formatAmount } from "@/lib/utils/currency";
import { useBillStore } from "@/presentation/store/billStore";
import { useUiStore } from "@/presentation/store/uiStore";
import { getParticipantColor, getAssignmentsForUnit } from "@/presentation/store/selectors/billSelectors";

type SplitMode = "equally" | "by_count" | "by_percentage" | "by_shares" | "by_amount" | "per_unit";

type EntryValue = { participantId: string; value: number };

type ItemAssignmentRowProps = {
  item: BillItemDto;
  billId: string;
  participants: ParticipantDto[];
  currency: string;
};

/**
 * Extracts a sub-unit count from an item name descriptor.
 * e.g. "Coke 35 Count" → 35, "Eggs 5 Dozen" → 60, "Water 12 Pk" → 12
 */
function extractSubCount(name: string): number | null {
  const dozenMatch = name.match(/(\d+(?:\.\d+)?)\s*dozen/i);
  if (dozenMatch) return Math.round(parseFloat(dozenMatch[1]) * 12);

  const countMatch = name.match(/(\d+)\s*[-]?\s*(?:count|ct|pack|pk|pcs?|pieces?)/i);
  if (countMatch) return parseInt(countMatch[1], 10);

  return null;
}

const MODE_LABELS: Record<SplitMode, string> = {
  equally: "Equally",
  by_count: "By Count",
  by_percentage: "By %",
  by_shares: "By Shares",
  by_amount: "By Amount",
  per_unit: "Per Unit",
};

export function ItemAssignmentRow({ item, billId, participants, currency }: ItemAssignmentRowProps) {
  const { setItemSplitConfig, assignUnit, unassignUnit, currentBill } = useBillStore();
  const { addToast } = useUiStore();

  // Default to "per_unit" for multi-unit items, "equally" for single-unit items
  const initialMode: SplitMode =
    (item.splitConfig?.mode as SplitMode | undefined) ?? (item.quantity > 1 ? "per_unit" : "equally");

  const [mode, setMode] = useState<SplitMode>(initialMode);

  // Entries: one per participant, value depends on mode
  const [entries, setEntries] = useState<EntryValue[]>(() => {
    if (item.splitConfig?.entries.length) {
      return participants.map((p) => {
        const existing = item.splitConfig!.entries.find((e) => e.participantId === p.id);
        return { participantId: p.id, value: existing?.value ?? 0 };
      });
    }
    return participants.map((p) => ({ participantId: p.id, value: 0 }));
  });

  // For "equally" mode, track which participants are toggled on
  const [equallySelected, setEquallySelected] = useState<Set<string>>(() => {
    if (item.splitConfig?.mode === "equally") {
      return new Set(item.splitConfig.entries.map((e) => e.participantId));
    }
    if (!item.splitConfig) return new Set(participants.map((p) => p.id));
    return new Set();
  });

  // Sync entries when participants change
  useEffect(() => {
    setEntries(participants.map((p) => {
      const existing = entries.find((e) => e.participantId === p.id);
      return { participantId: p.id, value: existing?.value ?? 0 };
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants.length]);

  function setEntryValue(participantId: string, value: number) {
    setEntries((prev) =>
      prev.map((e) => (e.participantId === participantId ? { ...e, value } : e))
    );
  }

  // ── Auto-save logic ──────────────────────────────────────────────────────────

  async function triggerAutoSave(
    effectiveMode: SplitMode,
    effectiveSelected: Set<string>,
    effectiveEntries: EntryValue[]
  ) {
    if (effectiveMode === "per_unit") {
      await setItemSplitConfig(billId, item.id, null);
      return;
    }

    let finalEntries: EntryValue[];
    if (effectiveMode === "equally") {
      finalEntries = [...effectiveSelected].map((id) => ({ participantId: id, value: 0 }));
    } else {
      finalEntries = effectiveEntries.filter((e) => e.value > 0);
    }

    if (finalEntries.length === 0) return;
    if (effectiveMode === "by_percentage") {
      const sum = finalEntries.reduce((s, e) => s + e.value, 0);
      if (Math.abs(sum - 100) > 0.01) return;
    }

    await setItemSplitConfig(billId, item.id, { mode: effectiveMode, entries: finalEntries });
  }

  // Equally: auto-save on chip toggle
  function handleEquallyToggle(participantId: string) {
    const next = new Set(equallySelected);
    if (next.has(participantId)) next.delete(participantId); else next.add(participantId);
    setEquallySelected(next);
    triggerAutoSave("equally", next, entries).catch((err) =>
      addToast(err instanceof Error ? err.message : "Failed to save", "error")
    );
  }

  // Mode dropdown: save current mode if valid, then switch + save new mode defaults
  async function handleModeChange(newMode: SplitMode) {
    try {
      await triggerAutoSave(mode, equallySelected, entries);
    } catch { /* ignore — switching away */ }
    setMode(newMode as SplitMode);
    if (newMode === "per_unit") {
      setItemSplitConfig(billId, item.id, null).catch(() => {});
    } else if (newMode === "equally") {
      // equallySelected already has all participants by default — save immediately
      triggerAutoSave("equally", equallySelected, entries).catch(() => {});
    }
  }

  // Numeric inputs: auto-save on blur
  function handleNumericBlur() {
    triggerAutoSave(mode, equallySelected, entries).catch((err) =>
      addToast(err instanceof Error ? err.message : "Failed to save", "error")
    );
  }

  // Per-unit: toggle participant for a specific unit
  async function handleToggleUnitParticipant(unitIndex: number, participantId: string) {
    const assigned = getAssignmentsForUnit(currentBill, item.id, unitIndex);
    const isAssigned = assigned.includes(participantId);
    try {
      if (isAssigned) {
        await unassignUnit(billId, item.id, participantId, unitIndex);
      } else {
        await assignUnit(billId, item.id, participantId, unitIndex);
      }
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : "Assignment failed", "error");
    }
  }

  // Validation helpers
  const percentSum = entries.reduce((s, e) => s + (e.value || 0), 0);
  const countSum = entries.reduce((s, e) => s + (e.value || 0), 0);
  const subCount = extractSubCount(item.name) ?? item.quantity;

  return (
    <div className="py-4 border-b border-slate-100 dark:border-slate-700 last:border-0">
      {/* Item info + mode selector */}
      <div className="flex items-start gap-4 mb-3">
        <div className="w-44 flex-shrink-0">
          <p className="font-medium text-slate-800 dark:text-slate-200 text-sm">{item.name}</p>
          <p className="text-xs text-slate-500">{formatAmount(item.unitPrice, currency)} × {item.quantity}</p>
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            = {formatAmount(item.totalPrice, currency)}
          </p>
        </div>
        <div className="flex-1">
          <select
            value={mode}
            onChange={(e) => handleModeChange(e.target.value as SplitMode)}
            className="text-xs border border-slate-300 dark:border-slate-600 rounded-md px-2 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {Object.entries(MODE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Mode-specific UI */}
      {mode === "equally" && (
        <div className="flex flex-wrap gap-2 ml-48">
          {participants.map((p, idx) => {
            const isOn = equallySelected.has(p.id);
            return (
              <button
                key={p.id}
                onClick={() => handleEquallyToggle(p.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border-2 ${
                  isOn
                    ? `${getParticipantColor(idx)} text-white border-transparent`
                    : "bg-white dark:bg-slate-800 text-slate-500 border-slate-300 hover:border-slate-400"
                }`}
              >
                {p.name}
              </button>
            );
          })}
        </div>
      )}

      {(mode === "by_count" || mode === "by_percentage" || mode === "by_shares" || mode === "by_amount") && (
        <div className="flex flex-col gap-2 ml-48">
          {participants.map((p, idx) => {
            const entry = entries.find((e) => e.participantId === p.id)!;
            const placeholder =
              mode === "by_percentage" ? "%" :
              mode === "by_count" ? `of ${subCount}` :
              mode === "by_shares" ? "shares" : currency;
            return (
              <div key={p.id} className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${getParticipantColor(idx)}`}>
                  {p.name.slice(0, 1).toUpperCase()}
                </div>
                <span className="text-sm text-slate-700 dark:text-slate-300 w-24 truncate">{p.name}</span>
                <input
                  type="number"
                  min={0}
                  step={mode === "by_count" || mode === "by_shares" ? "1" : "any"}
                  value={entry.value || ""}
                  onChange={(e) => setEntryValue(p.id, parseFloat(e.target.value) || 0)}
                  onBlur={handleNumericBlur}
                  placeholder={placeholder}
                  className="w-24 text-sm border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-right focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800"
                />
                {mode === "by_shares" && entry.value > 0 && (
                  <span className="text-xs text-slate-400">
                    {entries.reduce((s, e) => s + e.value, 0) > 0
                      ? `${((entry.value / entries.reduce((s, e) => s + e.value, 0)) * 100).toFixed(1)}%`
                      : ""}
                  </span>
                )}
              </div>
            );
          })}
          {/* Validation hints */}
          {mode === "by_percentage" && (
            <p className={`text-xs ml-9 ${Math.abs(percentSum - 100) > 0.01 ? "text-red-500" : "text-green-600"}`}>
              Total: {percentSum.toFixed(1)}% {Math.abs(percentSum - 100) > 0.01 ? "(must equal 100% to save)" : "✓ saved"}
            </p>
          )}
          {mode === "by_count" && (
            <p className={`text-xs ml-9 ${countSum > subCount ? "text-red-500" : "text-slate-400"}`}>
              {countSum} / {subCount} assigned
            </p>
          )}
          {mode === "by_amount" && (
            <p className="text-xs ml-9 text-slate-400">
              Total: {formatAmount(entries.reduce((s, e) => s + e.value, 0), currency)} / {formatAmount(item.totalPrice, currency)}
            </p>
          )}
        </div>
      )}

      {mode === "per_unit" && (
        <div className="flex flex-col gap-3 ml-48">
          {Array.from({ length: item.quantity }, (_, unitIndex) => {
            const assignedIds = getAssignmentsForUnit(currentBill, item.id, unitIndex);
            return (
              <div key={unitIndex} className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 w-14 flex-shrink-0">
                  Unit #{unitIndex + 1}
                </span>
                {participants.map((p, idx) => {
                  const isOn = assignedIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleToggleUnitParticipant(unitIndex, p.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border-2 ${
                        isOn
                          ? `${getParticipantColor(idx)} text-white border-transparent`
                          : "bg-white dark:bg-slate-800 text-slate-500 border-slate-300 hover:border-slate-400"
                      }`}
                    >
                      {p.name}
                    </button>
                  );
                })}
                {assignedIds.length === 0 && (
                  <span className="text-xs text-slate-400 italic">Unassigned</span>
                )}
                {assignedIds.length > 1 && (
                  <span className="text-xs text-slate-400">shared equally</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
