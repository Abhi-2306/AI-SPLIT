"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useUiStore } from "@/presentation/store/uiStore";
import { Button } from "@/presentation/components/ui/Button";
import { Input } from "@/presentation/components/ui/Input";
import { ConfirmDialog } from "@/presentation/components/ui/ConfirmDialog";
import { formatAmount } from "@/lib/utils/currency";
import { ROUTES } from "@/lib/constants/routes";
import Link from "next/link";

type Params = { params: Promise<{ friendId: string }> };

type FriendProfile = {
  displayName: string;
  avatarUrl: string | null;
};

type DebtSummary = {
  netBalance: number;
  currency: string | null;
  bills: Array<{
    billId: string;
    billTitle: string;
    myAmount: number;
    friendAmount: number;
    netEffect: number;
    currency: string;
    createdAt: string;
  }>;
};

type Settlement = {
  id: string;
  amount: number;
  currency: string;
  note: string | null;
  settledAt: string;
  paidByMe: boolean;
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `Today · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  if (hours < 48) return `Yesterday · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function FriendDetailPage({ params }: Params) {
  const { friendId } = use(params);
  const router = useRouter();
  const { addToast } = useUiStore();

  const [friend, setFriend] = useState<FriendProfile | null>(null);
  const [debt, setDebt] = useState<DebtSummary | null>(null);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);

  // Settle up modal
  const [showModal, setShowModal] = useState(false);
  const [settleAmount, setSettleAmount] = useState("");
  const [settleDirection, setSettleDirection] = useState<"i_paid" | "they_paid">("i_paid");
  const [settleNote, setSettleNote] = useState("");
  const [settling, setSettling] = useState(false);

  // Delete settlement
  const [confirmSettlement, setConfirmSettlement] = useState<Settlement | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function loadDebt() {
    return fetch(`/api/friends/${friendId}/debt`)
      .then((r) => r.json())
      .then((j) => { if (j.success) setDebt(j.data); })
      .catch(() => null);
  }

  function loadSettlements() {
    return fetch(`/api/friends/${friendId}/settlements`)
      .then((r) => r.json())
      .then((j) => { if (j.success) setSettlements(j.data); })
      .catch(() => null);
  }

  useEffect(() => {
    // Load friend profile from debt endpoint (contains display info)
    async function load() {
      const [profileRes] = await Promise.all([
        fetch(`/api/friends/${friendId}/profile`).then((r) => r.json()).catch(() => null),
        loadDebt(),
        loadSettlements(),
      ]);
      if (profileRes?.success) setFriend(profileRes.data);
      setLoading(false);
    }
    load();
  }, [friendId]); // eslint-disable-line react-hooks/exhaustive-deps

  function openModal() {
    const abs = debt ? Math.abs(debt.netBalance) : 0;
    setSettleAmount(abs > 0.005 ? abs.toFixed(2) : "");
    setSettleDirection((debt?.netBalance ?? 0) < 0 ? "i_paid" : "they_paid");
    setSettleNote("");
    setShowModal(true);
  }

  async function handleSettle() {
    const amount = parseFloat(settleAmount);
    if (!amount || amount <= 0) return;
    setSettling(true);
    try {
      const res = await fetch(`/api/friends/${friendId}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          currency: debt?.currency ?? "INR",
          note: settleNote.trim() || undefined,
          direction: settleDirection,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed to record payment");
      addToast("Payment recorded!", "success");
      setShowModal(false);
      window.dispatchEvent(new CustomEvent("settlement-recorded"));
      await Promise.all([loadDebt(), loadSettlements()]);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to record payment", "error");
    } finally {
      setSettling(false);
    }
  }

  async function handleDeleteSettlement() {
    if (!confirmSettlement) return;
    setDeletingId(confirmSettlement.id);
    try {
      const res = await fetch(
        `/api/friends/${friendId}/settlements?id=${confirmSettlement.id}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed to delete payment");
      setSettlements((prev) => prev.filter((s) => s.id !== confirmSettlement.id));
      await loadDebt();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to delete payment", "error");
    } finally {
      setDeletingId(null);
      setConfirmSettlement(null);
    }
  }

  const balance = debt?.netBalance ?? 0;
  const currency = debt?.currency ?? null;
  const hasBalance = Math.abs(balance) > 0.005 && currency !== null;
  const friendFirstName = friend?.displayName.split(" ")[0] ?? "them";

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.push(ROUTES.friends)}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          >
            ← Friends
          </button>
          <Button onClick={openModal} disabled={debt === null}>
            Settle Up
          </Button>
        </div>

        {/* Friend profile + balance */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 mb-6">
          <div className="flex items-center gap-4">
            {friend?.avatarUrl ? (
              <img src={friend.avatarUrl} alt="" className="w-14 h-14 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-xl flex-shrink-0">
                {friend?.displayName.charAt(0).toUpperCase() ?? "?"}
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                {friend?.displayName ?? "Friend"}
              </h1>
              {debt === null ? (
                <p className="text-sm text-slate-400 mt-0.5">Loading balance…</p>
              ) : hasBalance ? (
                <p className={`text-base font-semibold mt-0.5 ${balance > 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                  {balance > 0
                    ? `Owes you ${formatAmount(Math.abs(balance), currency!)}`
                    : `You owe ${formatAmount(Math.abs(balance), currency!)}`}
                </p>
              ) : (
                <p className="text-sm text-green-600 dark:text-green-400 font-medium mt-0.5">All settled up ✓</p>
              )}
            </div>
          </div>
        </div>

        {/* Bills + Settlements side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Shared Bills */}
          <div className="flex flex-col">
            <h2 className="font-semibold text-slate-700 dark:text-slate-200 mb-3">
              Shared Bills{debt && debt.bills.length > 0 ? ` (${debt.bills.length})` : ""}
            </h2>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex-1">
              {!debt || debt.bills.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No shared bills yet.</p>
              ) : (
                <div className="overflow-y-auto max-h-72 divide-y divide-slate-100 dark:divide-slate-700">
                  {debt.bills.map((b) => (
                    <Link
                      key={b.billId}
                      href={ROUTES.billSummary(b.billId)}
                      className="flex items-start justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <div className="min-w-0 mr-3">
                        <p className="text-sm text-slate-700 dark:text-slate-200 truncate">{b.billTitle}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{formatDate(b.createdAt)}</p>
                      </div>
                      <span className={`text-sm font-semibold flex-shrink-0 ${b.netEffect > 0 ? "text-green-600" : b.netEffect < 0 ? "text-red-500" : "text-slate-400"}`}>
                        {b.netEffect > 0
                          ? `+${formatAmount(b.netEffect, b.currency)}`
                          : b.netEffect < 0
                          ? `−${formatAmount(Math.abs(b.netEffect), b.currency)}`
                          : "even"}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Payment History */}
          <div className="flex flex-col">
            <h2 className="font-semibold text-slate-700 dark:text-slate-200 mb-3">
              Payment History{settlements.length > 0 ? ` (${settlements.length})` : ""}
            </h2>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex-1">
              {settlements.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No payments recorded yet.</p>
              ) : (
                <div className="overflow-y-auto max-h-72 divide-y divide-slate-100 dark:divide-slate-700">
                  {settlements.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => s.paidByMe && setConfirmSettlement(s)}
                      className={`flex items-start justify-between px-4 py-3 ${s.paidByMe ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50" : ""} transition-colors`}
                    >
                      <div className="min-w-0 mr-3">
                        <p className={`text-sm font-medium ${s.paidByMe ? "text-red-500 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                          {s.paidByMe ? `You paid ${friendFirstName}` : `${friendFirstName} paid you`}
                        </p>
                        {s.note && (
                          <p className="text-xs text-slate-400 italic truncate mt-0.5">{s.note}</p>
                        )}
                        <p className="text-xs text-slate-400 mt-0.5">{formatDate(s.settledAt)}</p>
                      </div>
                      <span className="text-sm font-semibold flex-shrink-0 text-slate-700 dark:text-slate-200">
                        {formatAmount(s.amount, s.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Settle Up Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-1">Settle Up</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
              Record a payment with{" "}
              <span className="font-medium text-slate-700 dark:text-slate-300">{friend?.displayName}</span>
            </p>

            <div className="flex rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden mb-4">
              <button
                onClick={() => setSettleDirection("i_paid")}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${settleDirection === "i_paid" ? "bg-blue-600 text-white" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"}`}
              >
                I paid
              </button>
              <button
                onClick={() => setSettleDirection("they_paid")}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${settleDirection === "they_paid" ? "bg-blue-600 text-white" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"}`}
              >
                {friendFirstName} paid
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              {settleDirection === "i_paid" ? `You paid ${friendFirstName}` : `${friendFirstName} paid you`}
            </p>

            <div className="mb-3">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Amount {debt?.currency ? `(${debt.currency})` : ""}
              </label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value)}
                autoFocus
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Note <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <Input
                placeholder="e.g. Dinner last night"
                value={settleNote}
                onChange={(e) => setSettleNote(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSettle()}
              />
            </div>

            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button
                className="flex-1"
                loading={settling}
                disabled={!settleAmount || parseFloat(settleAmount) <= 0}
                onClick={handleSettle}
              >
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmSettlement !== null}
        title="Delete payment?"
        message={`Remove the record of ${confirmSettlement ? formatAmount(confirmSettlement.amount, confirmSettlement.currency) : ""} paid to ${friend?.displayName}? This will affect your balance.`}
        confirmLabel="Delete"
        loading={deletingId !== null}
        onConfirm={handleDeleteSettlement}
        onCancel={() => setConfirmSettlement(null)}
      />
    </>
  );
}
