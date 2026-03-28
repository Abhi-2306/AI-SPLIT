"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFriendStore, type FriendDto } from "@/presentation/store/friendStore";
import { useUiStore } from "@/presentation/store/uiStore";
import { Button } from "@/presentation/components/ui/Button";
import { Input } from "@/presentation/components/ui/Input";
import { formatAmount } from "@/lib/utils/currency";
import { ROUTES } from "@/lib/constants/routes";
import { ConfirmDialog } from "@/presentation/components/ui/ConfirmDialog";

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

function FriendDebtCard({ friend }: { friend: FriendDto }) {
  const [debt, setDebt] = useState<DebtSummary | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [settleAmount, setSettleAmount] = useState("");
  const [settleDirection, setSettleDirection] = useState<"i_paid" | "they_paid">("i_paid");
  const [settleNote, setSettleNote] = useState("");
  const [settling, setSettling] = useState(false);
  const [confirmSettlement, setConfirmSettlement] = useState<Settlement | null>(null);
  const [deletingSettlementId, setDeletingSettlementId] = useState<string | null>(null);
  const { addToast } = useUiStore();

  function loadDebt() {
    fetch(`/api/friends/${friend.userId}/debt`)
      .then((r) => r.json())
      .then((j) => { if (j.success) setDebt(j.data); })
      .catch(() => null);
  }

  function loadSettlements() {
    fetch(`/api/friends/${friend.userId}/settlements`)
      .then((r) => r.json())
      .then((j) => { if (j.success) setSettlements(j.data); })
      .catch(() => null);
  }

  useEffect(() => {
    loadDebt();
    loadSettlements();
    // Refresh when a bill is deleted from the home page
    window.addEventListener("bill-deleted", loadDebt);
    return () => window.removeEventListener("bill-deleted", loadDebt);
  }, [friend.userId]); // eslint-disable-line react-hooks/exhaustive-deps

  function openModal() {
    const abs = debt ? Math.abs(debt.netBalance) : 0;
    setSettleAmount(abs > 0.005 ? abs.toFixed(2) : "");
    // Pre-select direction based on who owes: if I owe → I pay; if they owe → they pay
    setSettleDirection((debt?.netBalance ?? 0) < 0 ? "i_paid" : "they_paid");
    setSettleNote("");
    setShowModal(true);
  }

  async function handleSettle() {
    const amount = parseFloat(settleAmount);
    if (!amount || amount <= 0) return;
    setSettling(true);
    try {
      const res = await fetch(`/api/friends/${friend.userId}/settle`, {
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
      loadDebt();
      loadSettlements();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to record payment", "error");
    } finally {
      setSettling(false);
    }
  }

  async function handleDeleteSettlement() {
    if (!confirmSettlement) return;
    setDeletingSettlementId(confirmSettlement.id);
    try {
      const res = await fetch(
        `/api/friends/${friend.userId}/settlements?id=${confirmSettlement.id}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Failed to delete payment");
      setSettlements((prev) => prev.filter((s) => s.id !== confirmSettlement.id));
      loadDebt();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to delete payment", "error");
    } finally {
      setDeletingSettlementId(null);
      setConfirmSettlement(null);
    }
  }

  const balance = debt?.netBalance ?? 0;
  const currency = debt?.currency ?? null;
  const hasBalance = Math.abs(balance) > 0.005 && currency !== null;
  const mixedCurrencies = debt !== null && currency === null && debt.bills.length > 0;
  const hasActivity = (debt?.bills.length ?? 0) > 0 || settlements.length > 0;

  return (
    <>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        {/* Header row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            {friend.avatarUrl ? (
              <img src={friend.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-300 font-semibold text-sm flex-shrink-0">
                {friend.displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                {friend.displayName}
              </p>
              {debt === null ? (
                <p className="text-xs text-slate-400">Loading…</p>
              ) : hasBalance ? (
                <p className={`text-xs font-medium ${balance > 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                  {balance > 0
                    ? `Owes you ${formatAmount(Math.abs(balance), currency!)}`
                    : `You owe ${formatAmount(Math.abs(balance), currency!)}`}
                </p>
              ) : mixedCurrencies ? (
                <p className="text-xs text-slate-400">Multiple currencies — see details</p>
              ) : (
                <p className="text-xs text-green-600 dark:text-green-400 font-medium">All settled up ✓</p>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {hasActivity && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-xs text-blue-600 hover:underline"
              >
                {expanded ? "Hide" : "Details"}
              </button>
            )}
            {debt !== null && (
              <button
                onClick={openModal}
                className="text-xs px-2.5 py-1 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors"
              >
                Settle Up
              </button>
            )}
          </div>
        </div>

        {/* Expanded section */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex flex-col gap-3">
            {/* Bill breakdown */}
            {debt && debt.bills.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Bills</p>
                <div className="flex flex-col gap-1.5">
                  {debt.bills.map((b) => (
                    <div key={b.billId} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-300 truncate mr-2">{b.billTitle}</span>
                      <span className={`font-medium flex-shrink-0 ${b.netEffect > 0 ? "text-green-600" : b.netEffect < 0 ? "text-red-500" : "text-slate-400"}`}>
                        {b.netEffect > 0
                          ? `+${formatAmount(b.netEffect, b.currency)}`
                          : b.netEffect < 0
                          ? `-${formatAmount(Math.abs(b.netEffect), b.currency)}`
                          : "settled"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Settlement history */}
            {settlements.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Payments recorded</p>
                <div className="flex flex-col gap-1.5">
                  {settlements.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => s.paidByMe && setConfirmSettlement(s)}
                      className={`w-full flex items-center justify-between text-sm rounded-lg px-2 py-1.5 -mx-2 transition-colors ${s.paidByMe ? "hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer" : "cursor-default"}`}
                    >
                      <span className="text-slate-500 dark:text-slate-400 text-xs">{formatDate(s.settledAt)}</span>
                      <div className="flex items-center gap-2">
                        {s.note && (
                          <span className="text-xs text-slate-400 italic truncate max-w-[100px]">{s.note}</span>
                        )}
                        <span className={`font-medium flex-shrink-0 ${s.paidByMe ? "text-red-500" : "text-green-600"}`}>
                          {s.paidByMe
                            ? `You paid ${formatAmount(s.amount, s.currency)}`
                            : `${friend.displayName.split(" ")[0]} paid ${formatAmount(s.amount, s.currency)}`}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmSettlement !== null}
        title="Delete payment?"
        message={`Remove the record of ${confirmSettlement ? formatAmount(confirmSettlement.amount, confirmSettlement.currency) : ""} paid to ${friend.displayName}? This will affect your balance.`}
        confirmLabel="Delete"
        loading={deletingSettlementId !== null}
        onConfirm={handleDeleteSettlement}
        onCancel={() => setConfirmSettlement(null)}
      />

      {/* Settle Up Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-1">
              Settle Up
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
              Record a payment with{" "}
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {friend.displayName}
              </span>
            </p>

            {/* Direction toggle */}
            <div className="flex rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden mb-4">
              <button
                onClick={() => setSettleDirection("i_paid")}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  settleDirection === "i_paid"
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                }`}
              >
                I paid
              </button>
              <button
                onClick={() => setSettleDirection("they_paid")}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  settleDirection === "they_paid"
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                }`}
              >
                {friend.displayName.split(" ")[0]} paid
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              {settleDirection === "i_paid"
                ? `You paid ${friend.displayName.split(" ")[0]}`
                : `${friend.displayName.split(" ")[0]} paid you`}
            </p>

            {/* Amount */}
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

            {/* Note */}
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
              <Button variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
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
    </>
  );
}

export default function FriendsPage() {
  const router = useRouter();
  const { friends, requests, loading, loadFriends, loadRequests, sendRequest, acceptRequest, rejectRequest } =
    useFriendStore();
  const { addToast } = useUiStore();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ displayName: string; avatarUrl: string | null } | null>(null);

  useEffect(() => {
    loadFriends();
    loadRequests();
    fetch("/api/profile")
      .then((r) => r.json())
      .then((j) => { if (j.success) setCurrentUser(j.data); })
      .catch(() => null);
  }, [loadFriends, loadRequests]);

  async function handleSendRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    try {
      await sendRequest(email.trim());
      addToast("Friend request sent!", "success");
      setEmail("");
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : "Failed to send request", "error");
    } finally {
      setSending(false);
    }
  }

  async function handleAccept(requestId: string) {
    setActionLoading(requestId);
    try {
      await acceptRequest(requestId);
      addToast("Friend added!", "success");
    } catch {
      addToast("Failed to accept request", "error");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(requestId: string) {
    setActionLoading(requestId);
    try {
      await rejectRequest(requestId);
    } catch {
      addToast("Failed to reject request", "error");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Friends</h1>
        <div className="flex items-center gap-2">
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
          <Button variant="ghost" onClick={() => router.push(ROUTES.home)}>
            ← Home
          </Button>
        </div>
      </div>

      {/* Send friend request */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-6">
        <h2 className="font-semibold text-slate-700 dark:text-slate-200 mb-3">Add a Friend</h2>
        <form onSubmit={handleSendRequest} className="flex gap-2">
          <Input
            type="email"
            placeholder="friend@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" loading={sending}>
            Send Request
          </Button>
        </form>
      </div>

      {/* Incoming requests */}
      {requests.length > 0 && (
        <div className="mb-6">
          <h2 className="font-semibold text-slate-700 dark:text-slate-200 mb-3">
            Pending Requests ({requests.length})
          </h2>
          <div className="flex flex-col gap-2">
            {requests.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl p-3"
              >
                <div className="flex items-center gap-3">
                  {req.avatarUrl ? (
                    <img src={req.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center text-blue-700 dark:text-blue-300 font-semibold text-sm">
                      {req.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <p className="font-medium text-slate-800 dark:text-slate-100">{req.displayName}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => handleAccept(req.id)}
                    loading={actionLoading === req.id}
                  >
                    Accept
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => handleReject(req.id)}
                    loading={actionLoading === req.id}
                  >
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friends list */}
      <div>
        <h2 className="font-semibold text-slate-700 dark:text-slate-200 mb-3">
          Your Friends{friends.length > 0 ? ` (${friends.length})` : ""}
        </h2>
        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : friends.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p className="text-3xl mb-3">👥</p>
            <p className="text-sm">No friends yet. Send a request above!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {friends.map((friend) => (
              <FriendDebtCard key={friend.friendshipId} friend={friend} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
