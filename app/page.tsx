"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/presentation/components/ui/Button";
import { ConfirmDialog } from "@/presentation/components/ui/ConfirmDialog";
import { useUiStore } from "@/presentation/store/uiStore";
import { ROUTES } from "@/lib/constants/routes";
import { formatAmount } from "@/lib/utils/currency";
import { ActivityFeed } from "@/presentation/components/activity/ActivityFeed";

type CurrentUser = { displayName: string; avatarUrl: string | null };

type BillStats = {
  byCurrency: Record<string, { total: number; myShare: number }>;
};

type BillSummary = {
  id: string;
  title: string;
  currency: string;
  status: "draft" | "assigned" | "settled";
  participantCount: number;
  total: number;
  createdAt: string;
  isOwner: boolean;
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
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmBill, setConfirmBill] = useState<BillSummary | null>(null);
  const [stats, setStats] = useState<BillStats | null>(null);
  const { addToast } = useUiStore();

  useEffect(() => {
    fetch("/api/bills")
      .then((r) => r.json())
      .then((json) => { if (json.success) setBills(json.data); })
      .catch(console.error)
      .finally(() => setLoading(false));

    fetch("/api/bills/stats")
      .then((r) => r.json())
      .then((json) => { if (json.success) setStats(json.data); })
      .catch(console.error);

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

  async function handleDelete() {
    if (!confirmBill) return;
    setDeletingId(confirmBill.id);
    try {
      const res = await fetch(`/api/bills/${confirmBill.id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        setBills((prev) => prev.filter((b) => b.id !== confirmBill.id));
        window.dispatchEvent(new CustomEvent("bill-deleted"));
        addToast("Bill deleted", "success");
      } else {
        addToast(json.error?.message ?? "Failed to delete bill", "error");
      }
    } catch {
      addToast("Failed to delete bill", "error");
    } finally {
      setDeletingId(null);
      setConfirmBill(null);
    }
  }

  const filteredBills = bills.filter((b) =>
    b.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 gap-2">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 flex-shrink-0">AI Split</h1>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          <Button onClick={() => router.push(ROUTES.newBill)}>+ New Bill</Button>
          <Button variant="secondary" onClick={() => router.push(ROUTES.friends)}>
            <span className="hidden sm:inline">Friends</span><span className="sm:hidden">👥</span>
          </Button>
          <Button variant="secondary" onClick={() => router.push(ROUTES.groups)}>
            <span className="hidden sm:inline">Groups</span><span className="sm:hidden">🏘️</span>
          </Button>
          <Button variant="secondary" onClick={() => router.push(ROUTES.analytics)}>
            <span className="hidden sm:inline">Analytics</span><span className="sm:hidden">📊</span>
          </Button>
          <button
            onClick={() => router.push(ROUTES.profile)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            title="Profile"
          >
            {currentUser?.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="w-7 h-7 rounded-full object-cover"
              />
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

      {/* Two-column layout on large screens */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        {/* Bills section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-700 dark:text-slate-200">Your Bills</h2>
          </div>

          {/* Stats bar — bills total derived from list, my spend from API */}
          {!loading && bills.length > 0 && (() => {
            const totalByCurrency = bills.reduce<Record<string, number>>((acc, b) => {
              acc[b.currency] = (acc[b.currency] ?? 0) + b.total;
              return acc;
            }, {});
            return (
              <div className="flex flex-wrap gap-3 mb-4">
                {Object.entries(totalByCurrency).map(([currency, total]) => {
                  const myShare = stats?.byCurrency?.[currency]?.myShare;
                  return (
                    <div key={currency} className="flex gap-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 flex-1 min-w-[200px]">
                      <div className="flex-1 border-r border-slate-100 dark:border-slate-700 pr-3">
                        <p className="text-xs text-slate-400 mb-0.5">Bills total</p>
                        <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{formatAmount(total, currency)}</p>
                      </div>
                      <div className="flex-1 pl-1">
                        <p className="text-xs text-slate-400 mb-0.5">My spend</p>
                        {stats === null
                          ? <div className="w-3.5 h-3.5 mt-1 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                          : <p className="font-semibold text-blue-600 dark:text-blue-400 text-sm">{formatAmount(myShare ?? 0, currency)}</p>
                        }
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Search bar */}
          {bills.length > 0 && (
            <div className="relative mb-3">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search bills…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : bills.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <p className="text-5xl mb-4">🧾</p>
              <p className="text-lg font-medium text-slate-600 dark:text-slate-400">No bills yet</p>
              <p className="text-sm mt-1 mb-6">Create your first bill to get started</p>
              <Button onClick={() => router.push(ROUTES.newBill)}>Create a Bill</Button>
            </div>
          ) : filteredBills.length === 0 ? (
            <p className="text-center py-10 text-sm text-slate-400">No bills match "{search}"</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredBills.map((bill) => (
                <div
                  key={bill.id}
                  className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                      {bill.title}
                    </h3>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {!bill.isOwner && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                          Shared
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[bill.status] ?? STATUS_COLORS.draft}`}>
                        {STATUS_LABELS[bill.status] ?? bill.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-sm text-slate-500">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {formatAmount(bill.total, bill.currency)}
                    </span>
                    <span>·</span>
                    <span>
                      {bill.participantCount} participant
                      {bill.participantCount !== 1 ? "s" : ""}
                    </span>
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
                    {bill.isOwner && (
                      <button
                        onClick={() => setConfirmBill(bill)}
                        className="ml-auto text-xs px-2.5 py-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                        title="Delete bill"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      <ConfirmDialog
        open={confirmBill !== null}
        title="Delete bill?"
        message={`"${confirmBill?.title}" will be permanently deleted. Any debt it contributed to will also be removed from your friends' balances.`}
        confirmLabel="Delete"
        loading={deletingId !== null}
        onConfirm={handleDelete}
        onCancel={() => setConfirmBill(null)}
      />

        {/* Activity feed — hidden on mobile, sticky sidebar on large screens */}
        <div className="hidden lg:flex sticky top-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex-col max-h-[calc(100vh-6rem)]">
          <h2 className="font-semibold text-slate-700 dark:text-slate-200 mb-3 flex-shrink-0">Recent Activity</h2>
          <div className="overflow-y-auto flex-1 -mx-1 px-1">
            <ActivityFeed />
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 text-center flex-shrink-0">
            <button
              onClick={handleSignOut}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
