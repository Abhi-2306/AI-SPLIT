"use client";

import { useState } from "react";
import type { ParsedItemDto } from "@/application/dtos/index";
import { Button } from "@/presentation/components/ui/Button";
import { Input } from "@/presentation/components/ui/Input";
import { useBillStore } from "@/presentation/store/billStore";
import { useUiStore } from "@/presentation/store/uiStore";

type OcrResultPreviewProps = {
  billId: string;
  onDone: () => void;
};

type EditableItem = ParsedItemDto & { selected: boolean };

export function OcrResultPreview({ billId, onDone }: OcrResultPreviewProps) {
  const { ocrResult, clearOcrResult, batchAddItems, updateBillMeta } = useBillStore();
  const { addToast } = useUiStore();
  const [items, setItems] = useState<EditableItem[]>(
    () => ocrResult?.parsedItems.map((item) => ({ ...item, selected: true })) ?? []
  );
  const [applyTax, setApplyTax] = useState(true);
  const [applyDiscount, setApplyDiscount] = useState(true);
  const [applyTip, setApplyTip] = useState(true);
  const [saving, setSaving] = useState(false);

  if (!ocrResult) return null;

  function updateItem(index: number, patch: Partial<EditableItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  async function confirmItems() {
    const selected = items.filter((i) => i.selected);
    if (selected.length === 0) {
      addToast("No items selected", "error");
      return;
    }
    setSaving(true);
    try {
      await batchAddItems(
        billId,
        selected.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        }))
      );
      // Auto-apply detected tax/fees (minus discount) and/or tip if checked
      let taxToApply: number | undefined;
      if (applyTax && ocrResult!.detectedTax !== null) {
        const gross = ocrResult!.detectedTax;
        const disc = applyDiscount && ocrResult!.detectedDiscount !== null ? ocrResult!.detectedDiscount : 0;
        taxToApply = Math.max(0, gross - disc);
      }
      const tipToApply = applyTip && ocrResult!.detectedTip !== null ? ocrResult!.detectedTip : undefined;
      if (taxToApply !== undefined || tipToApply !== undefined) {
        await updateBillMeta(billId, {
          ...(taxToApply !== undefined ? { tax: taxToApply } : {}),
          ...(tipToApply !== undefined ? { tip: tipToApply } : {}),
        });
      }
      addToast(`Added ${selected.length} item(s) from receipt`, "success");
      clearOcrResult();
      onDone();
    } catch {
      addToast("Failed to add items", "error");
    } finally {
      setSaving(false);
    }
  }

  const confidenceBadge = (c: string) =>
    c === "high" ? "text-green-600" : c === "medium" ? "text-yellow-600" : "text-red-500";

  const hasTax = ocrResult.detectedTax !== null && ocrResult.detectedTax > 0;
  const hasDiscount = ocrResult.detectedDiscount !== null && ocrResult.detectedDiscount > 0;
  const hasTip = ocrResult.detectedTip !== null && ocrResult.detectedTip > 0;
  const netTax = hasTax
    ? Math.max(0, ocrResult.detectedTax! - (applyDiscount && hasDiscount ? ocrResult.detectedDiscount! : 0))
    : 0;

  return (
    <div className="mt-4 border border-blue-200 rounded-xl bg-blue-50 dark:bg-blue-950 dark:border-blue-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-700 dark:text-slate-200">
          OCR Result — Review & Confirm
        </h3>
        <span className="text-xs text-slate-500">
          Confidence: {Math.round(ocrResult.confidence * 100)}%
        </span>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-slate-500">No items detected. Add items manually below.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-slate-800 border ${item.selected ? "border-blue-300" : "border-slate-200 opacity-60"}`}
            >
              <input
                type="checkbox"
                checked={item.selected}
                onChange={(e) => updateItem(idx, { selected: e.target.checked })}
                className="accent-blue-600 w-4 h-4 flex-shrink-0"
              />
              <div className="flex-1 flex gap-2">
                <div className="flex-1 flex flex-col gap-0.5">
                  <span className="text-xs text-slate-400">Name</span>
                  <Input
                    value={item.name}
                    onChange={(e) => updateItem(idx, { name: e.target.value })}
                    placeholder="Item name"
                  />
                </div>
                <div className="w-16 flex flex-col gap-0.5">
                  <span className="text-xs text-slate-400">Qty</span>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={item.quantity}
                    onChange={(e) => updateItem(idx, { quantity: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div className="w-24 flex flex-col gap-0.5">
                  <span className="text-xs text-slate-400">Unit Price</span>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={item.unitPrice}
                    onChange={(e) => updateItem(idx, { unitPrice: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <span className={`text-xs font-medium ${confidenceBadge(item.confidence)}`}>
                {item.confidence}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Detected tax / discount / tip auto-apply checkboxes */}
      {(hasTax || hasDiscount || hasTip) && (
        <div className="mt-3 flex flex-col gap-1.5 border-t border-blue-200 dark:border-blue-700 pt-3">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Detected charges:</p>
          {hasTax && (
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={applyTax}
                onChange={(e) => setApplyTax(e.target.checked)}
                className="accent-blue-600 w-4 h-4"
              />
              Fees / tax: <span className="font-semibold">+{ocrResult.detectedTax?.toFixed(2)}</span>
            </label>
          )}
          {hasDiscount && (
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={applyDiscount}
                onChange={(e) => setApplyDiscount(e.target.checked)}
                className="accent-green-600 w-4 h-4"
              />
              Discount: <span className="font-semibold text-green-600">−{ocrResult.detectedDiscount?.toFixed(2)}</span>
            </label>
          )}
          {hasTax && hasDiscount && (
            <p className="text-xs text-slate-500 ml-6">
              Net applied: <span className="font-semibold text-slate-700 dark:text-slate-300">{netTax.toFixed(2)}</span>
            </p>
          )}
          {hasTip && (
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={applyTip}
                onChange={(e) => setApplyTip(e.target.checked)}
                className="accent-blue-600 w-4 h-4"
              />
              Tip / gratuity: <span className="font-semibold">+{ocrResult.detectedTip?.toFixed(2)}</span>
            </label>
          )}
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <Button onClick={confirmItems} loading={saving}>
          Add {items.filter((i) => i.selected).length} Item(s) to Bill
        </Button>
        <Button variant="ghost" onClick={() => { clearOcrResult(); onDone(); }}>
          Skip
        </Button>
      </div>
    </div>
  );
}
