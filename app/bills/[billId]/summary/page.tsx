"use client";

import { useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useBillStore } from "@/presentation/store/billStore";
import { SplitSummaryPanel } from "@/presentation/components/summary/SplitSummaryPanel";
import { Button } from "@/presentation/components/ui/Button";
import { ROUTES } from "@/lib/constants/routes";

type Params = { params: Promise<{ billId: string }> };

export default function SummaryPage({ params }: Params) {
  const { billId } = use(params);
  const router = useRouter();
  const { currentBill, splitResult, loadBill, calculateSplit } = useBillStore();

  useEffect(() => {
    async function load() {
      await loadBill(billId);
      await calculateSplit(billId);
    }
    load().catch(console.error);
  }, [billId, loadBill, calculateSplit]);

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
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => router.back()}
          >
            ← Back
          </Button>
          <Button
            variant="secondary"
            onClick={() => router.push(ROUTES.newBill)}
          >
            New Bill
          </Button>
        </div>
      </div>

      <SplitSummaryPanel splitResult={splitResult} bill={currentBill} />
    </div>
  );
}
