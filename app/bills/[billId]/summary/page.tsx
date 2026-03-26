"use client";

import { useEffect, use, useState } from "react";
import { useRouter } from "next/navigation";
import { useBillStore } from "@/presentation/store/billStore";
import { useUiStore } from "@/presentation/store/uiStore";
import { SplitSummaryPanel } from "@/presentation/components/summary/SplitSummaryPanel";
import { Button } from "@/presentation/components/ui/Button";
import { ROUTES } from "@/lib/constants/routes";
import { formatAmount } from "@/lib/utils/currency";
import type { SplitResultDto, BillDto } from "@/application/dtos/index";

type Params = { params: Promise<{ billId: string }> };

function buildSummaryText(splitResult: SplitResultDto, bill: BillDto): string {
  const lines: string[] = [];
  lines.push(`${bill.title} — ${formatAmount(bill.total, bill.currency)}`);
  lines.push("");

  for (const ps of splitResult.participantSplits) {
    const itemNames = ps.itemShares.map((s) => s.item.name).join(", ");
    lines.push(
      `${ps.participant.name}: ${formatAmount(ps.total, bill.currency)}${itemNames ? ` (${itemNames})` : ""}`
    );
  }

  if (splitResult.settlements.length > 0) {
    lines.push("");
    lines.push("Settlements:");
    for (const s of splitResult.settlements) {
      lines.push(`  ${s.from.name} owes ${s.to.name} ${formatAmount(s.amount, bill.currency)}`);
    }
  }

  return lines.join("\n");
}

export default function SummaryPage({ params }: Params) {
  const { billId } = use(params);
  const router = useRouter();
  const { currentBill, splitResult, loadBill, calculateSplit } = useBillStore();
  const { addToast } = useUiStore();
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    async function load() {
      await loadBill(billId);
      await calculateSplit(billId);
    }
    load().catch(console.error);
  }, [billId, loadBill, calculateSplit]);

  async function handleCopy() {
    if (!splitResult || !currentBill) return;
    setCopying(true);
    try {
      const text = buildSummaryText(splitResult, currentBill);
      await navigator.clipboard.writeText(text);
      addToast("Summary copied to clipboard", "success");
    } catch {
      addToast("Failed to copy", "error");
    } finally {
      setCopying(false);
    }
  }

  if (!currentBill || !splitResult) {
    return (
      <div className="text-center py-20">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="mt-4 text-slate-500">Calculating split...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Split Summary
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{currentBill.title}</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Button
            variant="secondary"
            onClick={() => router.push(ROUTES.bill(billId) + "?step=3")}
          >
            ← Edit Assignments
          </Button>
          <Button variant="secondary" onClick={handleCopy} loading={copying}>
            Copy Summary
          </Button>
          <Button
            variant="secondary"
            onClick={() => router.push(ROUTES.home)}
          >
            Home
          </Button>
        </div>
      </div>

      <SplitSummaryPanel splitResult={splitResult} bill={currentBill} />
    </div>
  );
}
