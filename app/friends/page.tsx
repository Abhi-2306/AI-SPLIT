"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFriendStore, type FriendDto } from "@/presentation/store/friendStore";
import { useUiStore } from "@/presentation/store/uiStore";
import { Button } from "@/presentation/components/ui/Button";
import { Input } from "@/presentation/components/ui/Input";
import { formatAmount } from "@/lib/utils/currency";
import { ROUTES } from "@/lib/constants/routes";

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

function FriendDebtCard({ friend }: { friend: FriendDto }) {
  const [debt, setDebt] = useState<DebtSummary | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch(`/api/friends/${friend.userId}/debt`)
      .then((r) => r.json())
      .then((j) => { if (j.success) setDebt(j.data); })
      .catch(() => null);
  }, [friend.userId]);

  const balance = debt?.netBalance ?? 0;
  const currency = debt?.currency ?? null;
  // Show balance only when we have a single currency and a non-trivial amount
  const hasBalance = Math.abs(balance) > 0.005 && currency !== null;
  const mixedCurrencies = debt !== null && currency === null && (debt.bills.length > 0);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {friend.avatarUrl ? (
            <img src={friend.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-300 font-semibold text-sm">
              {friend.displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-semibold text-slate-800 dark:text-slate-100">{friend.displayName}</p>
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
              <p className="text-xs text-slate-400">All settled up</p>
            )}
          </div>
        </div>
        {(debt?.bills.length ?? 0) > 0 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-blue-600 hover:underline"
          >
            {expanded ? "Hide" : "Details"}
          </button>
        )}
      </div>

      {expanded && debt && debt.bills.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex flex-col gap-2">
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
      )}
    </div>
  );
}

export default function FriendsPage() {
  const router = useRouter();
  const { friends, requests, loading, loadFriends, loadRequests, sendRequest, acceptRequest, rejectRequest } = useFriendStore();
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
