"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatAmount } from "@/lib/utils/currency";
import { ROUTES } from "@/lib/constants/routes";
import type { ActivityItem } from "@/app/api/activity/route";

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (weeks < 5) return `${weeks}w ago`;
  return `${months}mo ago`;
}

function ItemAvatar({ item }: { item: ActivityItem }) {
  if (item.type === "friend_added" || item.type === "settlement_paid") {
    if (item.friendAvatarUrl) {
      return (
        <img
          src={item.friendAvatarUrl}
          alt=""
          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
        />
      );
    }
    return (
      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
        <span className="text-blue-700 dark:text-blue-300 text-xs font-semibold">
          {item.friendName?.charAt(0).toUpperCase() ?? "?"}
        </span>
      </div>
    );
  }

  return (
    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
      <span className="text-base">🧾</span>
    </div>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  let headline: React.ReactNode;
  let sub: string | null = null;

  if (item.type === "bill_created") {
    headline = (
      <>
        You added{" "}
        <Link
          href={ROUTES.bill(item.billId!)}
          className="font-semibold text-slate-800 dark:text-slate-100 hover:underline"
        >
          {item.billTitle}
        </Link>
      </>
    );
    if (item.userShare !== undefined && item.currency) {
      if (item.userShare > 0) {
        sub = `You are owed ${formatAmount(item.userShare, item.currency)}`;
      } else if (item.userShare < 0) {
        sub = `You owe ${formatAmount(-item.userShare, item.currency)}`;
      } else {
        sub = "You are settled up";
      }
    }
  } else if (item.type === "bill_deleted") {
    headline = (
      <>
        Deleted{" "}
        <span className="font-semibold text-slate-800 dark:text-slate-100">
          {item.billTitle}
        </span>
      </>
    );
    if (item.totalAmount !== undefined && item.currency && item.totalAmount > 0) {
      sub = formatAmount(item.totalAmount, item.currency);
    }
  } else if (item.type === "bill_shared") {
    headline = (
      <>
        Added to{" "}
        <Link
          href={ROUTES.bill(item.billId!)}
          className="font-semibold text-slate-800 dark:text-slate-100 hover:underline"
        >
          {item.billTitle}
        </Link>
      </>
    );
    if (item.userShare !== undefined && item.currency) {
      if (item.userShare > 0) {
        sub = `You are owed ${formatAmount(item.userShare, item.currency)}`;
      } else if (item.userShare < 0) {
        sub = `You owe ${formatAmount(-item.userShare, item.currency)}`;
      } else {
        sub = "You are settled up";
      }
    }
  } else if (item.type === "settlement_paid") {
    headline = item.isOwner ? (
      <>
        You paid{" "}
        <span className="font-semibold text-slate-800 dark:text-slate-100">
          {item.friendName}
        </span>
      </>
    ) : (
      <>
        <span className="font-semibold text-slate-800 dark:text-slate-100">
          {item.friendName}
        </span>{" "}
        paid you
      </>
    );
    if (item.totalAmount !== undefined && item.currency) {
      sub = formatAmount(item.totalAmount, item.currency);
    }
  } else {
    headline = (
      <>
        You became friends with{" "}
        <span className="font-semibold text-slate-800 dark:text-slate-100">
          {item.friendName}
        </span>
      </>
    );
  }

  return (
    <div className="flex items-start gap-3 px-2 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
      <ItemAvatar item={item} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-snug">{headline}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
      <span className="text-xs text-slate-400 flex-shrink-0 mt-0.5 whitespace-nowrap">
        {timeAgo(item.createdAt)}
      </span>
    </div>
  );
}

export function ActivityFeed() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  function loadActivity() {
    fetch("/api/activity")
      .then((r) => r.json())
      .then((j) => { if (j.success) setItems(j.data); })
      .catch(() => null)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadActivity();
    window.addEventListener("bill-deleted", loadActivity);
    window.addEventListener("bill-created", loadActivity);
    window.addEventListener("settlement-recorded", loadActivity);
    return () => {
      window.removeEventListener("bill-deleted", loadActivity);
      window.removeEventListener("bill-created", loadActivity);
      window.removeEventListener("settlement-recorded", loadActivity);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-400 text-center py-8">No activity yet.</p>
    );
  }

  return (
    <div className="flex flex-col">
      {items.map((item) => (
        <ActivityRow key={item.id} item={item} />
      ))}
    </div>
  );
}
