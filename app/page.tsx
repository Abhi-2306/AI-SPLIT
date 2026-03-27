"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/presentation/components/ui/Button";
import { ROUTES } from "@/lib/constants/routes";
import { formatAmount } from "@/lib/utils/currency";

type CurrentUser = { displayName: string; avatarUrl: string | null };

type BillSummary = {
  id: string;
  title: string;
  currency: string;
  status: "draft" | "assigned" | "settled";
  participantCount: number;
  total: number;
  createdAt: string;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  assigned: "Assigned",
  settled: "Settled",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  assigned: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  settled: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
};

export default function HomePage() {
  const router = useRouter();
  const [bills, setBills] = useState<BillSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    fetch("/api/bills")
      .then((r) => r.json())
      .then((json) => { if (json.success) setBills(json.data); })
      .catch(console.error)
      .finally(() => setLoading(false));

    fetch("/api/profile")
      .then((r) => r.json())
      .then((json) => { if (json.success) setCurrentUser(json.data); })
      .catch(console.error);
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Your Bills
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => router.push(ROUTES.newBill)}>
            + New Bill
          </Button>
          <Button variant="secondary" onClick={() => router.push(ROUTES.friends)}>
            Friends
          </Button>
          <button
            onClick={() => router.push(ROUTES.profile)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            title="Profile"
          >
            {currentUser?.avatarUrl ? (
              <img src={currentUser.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-300 text-xs font-bold">
                {currentUser?.displayName?.charAt(0).toUpperCase() ?? "?"}
              </div>
            )}
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200 hidden sm:block">
              {currentUser?.displayName ?? ""}
            </span>
          </button>
        </div>
      </div>

        {/* Bill list */}
        {loading ? (
          <div className="text-center py-20">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : bills.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <p className="text-5xl mb-4">🧾</p>
            <p className="text-lg font-medium text-slate-600 dark:text-slate-400">No bills yet</p>
            <p className="text-sm mt-1 mb-6">Create your first bill to get started</p>
            <Button onClick={() => router.push(ROUTES.newBill)}>Create a Bill</Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {bills.map((bill) => (
              <div
                key={bill.id}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                    {bill.title}
                  </h2>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_COLORS[bill.status] ?? STATUS_COLORS.draft}`}
                  >
                    {STATUS_LABELS[bill.status] ?? bill.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-2 text-sm text-slate-500">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {formatAmount(bill.total, bill.currency)}
                  </span>
                  <span>·</span>
                  <span>{bill.participantCount} participant{bill.participantCount !== 1 ? "s" : ""}</span>
                  <span>·</span>
                  <span>{new Date(bill.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex gap-2 mt-3">
                  {(bill.status === "assigned" || bill.status === "settled") && (
                    <Link
                      href={ROUTES.billSummary(bill.id)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium transition-colors"
                    >
                      View Summary
                    </Link>
                  )}
                  <Link
                    href={ROUTES.bill(bill.id)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium transition-colors"
                  >
                    {bill.status === "draft" ? "Continue" : "Edit"}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
