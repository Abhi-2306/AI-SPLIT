"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/presentation/components/ui/Input";
import { Select } from "@/presentation/components/ui/Select";
import { Button } from "@/presentation/components/ui/Button";
import { Card, CardHeader, CardBody } from "@/presentation/components/ui/Card";
import { useBillStore } from "@/presentation/store/billStore";
import { useUiStore } from "@/presentation/store/uiStore";
import { SUPPORTED_CURRENCIES, DEFAULT_CURRENCY } from "@/lib/constants/config";
import { ROUTES } from "@/lib/constants/routes";

export default function NewBillPage() {
  const [title, setTitle] = useState("");
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [loading, setLoading] = useState(false);
  const { createBill } = useBillStore();
  const { addToast } = useUiStore();
  const router = useRouter();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { addToast("Please enter a bill title", "error"); return; }
    setLoading(true);
    try {
      const bill = await createBill(title.trim(), currency);
      router.push(ROUTES.bill(bill.id));
    } catch {
      addToast("Failed to create bill. Please try again.", "error");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-2">
          Create a New Bill
        </h1>
        <p className="text-slate-500">
          Split any bill fairly — by item, by quantity, per person.
        </p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-slate-700 dark:text-slate-300">Bill Details</h2>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <Input
              label="Bill Title"
              placeholder="e.g. Dinner at The Grand, Team Lunch, Trip Expenses"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
            <Select
              label="Currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              options={SUPPORTED_CURRENCIES.map((c) => ({ value: c.code, label: c.label }))}
            />
            <Button type="submit" loading={loading} size="lg" className="mt-2">
              Create Bill →
            </Button>
          </form>
        </CardBody>
      </Card>

      <div className="mt-6 grid grid-cols-3 gap-3 text-center text-sm text-slate-500">
        <div className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <p className="text-2xl mb-1">📷</p>
          <p>Scan receipt with OCR</p>
        </div>
        <div className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <p className="text-2xl mb-1">🍕</p>
          <p>Split by quantity</p>
        </div>
        <div className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <p className="text-2xl mb-1">💰</p>
          <p>Fair per-person totals</p>
        </div>
      </div>
    </div>
  );
}
