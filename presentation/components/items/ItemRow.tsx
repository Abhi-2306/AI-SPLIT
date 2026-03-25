"use client";

import { useState } from "react";
import type { BillItemDto } from "@/application/dtos/index";
import { Input } from "@/presentation/components/ui/Input";
import { Button } from "@/presentation/components/ui/Button";
import { useBillStore } from "@/presentation/store/billStore";
import { useUiStore } from "@/presentation/store/uiStore";

type ItemRowProps = {
  item: BillItemDto;
  billId: string;
  currency: string;
};

export function ItemRow({ item, billId, currency }: ItemRowProps) {
  const { updateItem, deleteItem } = useBillStore();
  const { addToast } = useUiStore();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [unitPrice, setUnitPrice] = useState(String(item.unitPrice));
  const [saving, setSaving] = useState(false);

  async function saveEdit() {
    const qty = parseInt(quantity);
    const price = parseFloat(unitPrice);
    if (!name.trim() || !qty || qty < 1 || isNaN(price) || price < 0) {
      addToast("Invalid values", "error");
      return;
    }
    setSaving(true);
    try {
      await updateItem(billId, item.id, { name: name.trim(), quantity: qty, unitPrice: price });
      setEditing(false);
    } catch {
      addToast("Failed to update item", "error");
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    setName(item.name);
    setQuantity(String(item.quantity));
    setUnitPrice(String(item.unitPrice));
    setEditing(false);
  }

  async function handleDelete() {
    try {
      await deleteItem(billId, item.id);
    } catch {
      addToast("Failed to delete item", "error");
    }
  }

  if (editing) {
    return (
      <tr className="border-b border-slate-100 dark:border-slate-700 bg-blue-50 dark:bg-blue-950">
        <td className="px-4 py-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Item name" />
        </td>
        <td className="px-4 py-2 w-24">
          <Input type="number" min={1} step={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </td>
        <td className="px-4 py-2 w-32">
          <Input type="number" min={0} step="any" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
        </td>
        <td className="px-4 py-2 w-24 text-right">
          <span className="text-sm text-slate-600 dark:text-slate-400">
            {parseFloat(unitPrice) * parseInt(quantity) || 0}
          </span>
        </td>
        <td className="px-4 py-2 w-24">
          <div className="flex gap-1">
            <Button size="sm" onClick={saveEdit} loading={saving}>Save</Button>
            <Button size="sm" variant="ghost" onClick={cancelEdit}>✕</Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 group">
      <td className="px-4 py-3 text-sm font-medium text-slate-800 dark:text-slate-200">{item.name}</td>
      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 text-center">×{item.quantity}</td>
      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{item.unitPrice}</td>
      <td className="px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-200 text-right">{item.totalPrice}</td>
      <td className="px-4 py-3">
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>✏️</Button>
          <Button size="sm" variant="ghost" onClick={handleDelete}>🗑️</Button>
        </div>
      </td>
    </tr>
  );
}
