"use client";

import { useState } from "react";
import { Input } from "@/presentation/components/ui/Input";
import { Button } from "@/presentation/components/ui/Button";
import { useBillStore } from "@/presentation/store/billStore";
import { useUiStore } from "@/presentation/store/uiStore";

type ItemFormProps = {
  billId: string;
};

export function ItemForm({ billId }: ItemFormProps) {
  const { addItem } = useBillStore();
  const { addToast } = useUiStore();
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { addToast("Item name is required", "error"); return; }
    const qty = parseInt(quantity);
    if (!qty || qty < 1) { addToast("Quantity must be at least 1", "error"); return; }
    const price = parseFloat(unitPrice);
    if (isNaN(price) || price < 0) { addToast("Enter a valid price", "error"); return; }

    setLoading(true);
    try {
      await addItem(billId, { name: name.trim(), quantity: qty, unitPrice: price });
      setName("");
      setQuantity("1");
      setUnitPrice("");
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : "Failed to add item", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-12 gap-2 items-end p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-dashed border-slate-300 dark:border-slate-600">
      <div className="col-span-5">
        <Input
          label="Item Name"
          placeholder="e.g. Pizza Margherita"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="col-span-2">
        <Input
          label="Qty"
          type="number"
          min={1}
          step={1}
          placeholder="1"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
      </div>
      <div className="col-span-3">
        <Input
          label="Unit Price"
          type="number"
          min={0}
          step="any"
          placeholder="0"
          value={unitPrice}
          onChange={(e) => setUnitPrice(e.target.value)}
        />
      </div>
      <div className="col-span-2">
        <Button type="submit" loading={loading} className="w-full">
          + Add
        </Button>
      </div>
    </form>
  );
}
