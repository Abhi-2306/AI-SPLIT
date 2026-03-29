"use client";

import { useState, useEffect } from "react";
import type { BillItemDto } from "@/application/dtos/index";
import { ItemRow } from "./ItemRow";
import { formatAmount } from "@/lib/utils/currency";

type ItemListProps = {
  items: BillItemDto[];
  billId: string;
  currency: string;
  subtotal: number;
  tax: number | null;
  tip: number | null;
  total: number;
  onTaxChange: (value: number | null) => void;
  onTipChange: (value: number | null) => void;
};

export function ItemList({
  items,
  billId,
  currency,
  subtotal,
  tax,
  tip,
  total,
  onTaxChange,
  onTipChange,
}: ItemListProps) {
  // Local state so typing doesn't trigger API on every keystroke
  const [localTax, setLocalTax] = useState<string>(tax !== null ? String(tax) : "");
  const [localTip, setLocalTip] = useState<string>(tip !== null ? String(tip) : "");

  // Sync when the prop changes externally (e.g. OCR auto-apply)
  useEffect(() => { setLocalTax(tax !== null ? String(tax) : ""); }, [tax]);
  useEffect(() => { setLocalTip(tip !== null ? String(tip) : ""); }, [tip]);

  if (items.length === 0) {
    return (
      <div className="text-center py-10 text-slate-400">
        <p className="text-4xl mb-2">🛒</p>
        <p>No items yet. Upload a receipt or add items manually below.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">Item</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-600 dark:text-slate-400">Qty</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-400">Unit Price</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-600 dark:text-slate-400">Total</th>
              <th className="px-4 py-3 w-24" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <ItemRow key={item.id} item={item} billId={billId} currency={currency} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals bar */}
      <div className="mt-4 flex flex-col items-end gap-2">
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-500">Subtotal:</span>
          <span className="font-semibold w-28 text-right">{formatAmount(subtotal, currency)}</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-500">Tax:</span>
          <input
            type="number"
            min={0}
            step="any"
            placeholder="0"
            value={localTax}
            onChange={(e) => setLocalTax(e.target.value)}
            onBlur={(e) => onTaxChange(e.target.value ? parseFloat(e.target.value) : null)}
            className="w-28 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-500">Tip:</span>
          <input
            type="number"
            min={0}
            step="any"
            placeholder="0"
            value={localTip}
            onChange={(e) => setLocalTip(e.target.value)}
            onBlur={(e) => onTipChange(e.target.value ? parseFloat(e.target.value) : null)}
            className="w-28 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-3 text-sm border-t border-slate-200 pt-2 mt-1">
          <span className="font-bold text-slate-700 dark:text-slate-200">Total:</span>
          <span className="font-bold text-lg w-28 text-right">{formatAmount(total, currency)}</span>
        </div>
      </div>
    </div>
  );
}
