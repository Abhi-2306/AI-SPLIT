"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ROUTES } from "@/lib/constants/routes";
import { SUPPORTED_CURRENCIES } from "@/lib/constants/config";
import { formatAmount, getCurrencySymbol } from "@/lib/utils/currency";
import { convertAmount } from "@/lib/utils/exchangeRates";
import { Button } from "@/presentation/components/ui/Button";

type MonthlyEntry = { month: string; total: number; currency: string; billCount: number };
type TopFriend = {
  friendId: string;
  displayName: string;
  avatarUrl: string | null;
  sharedBillCount: number;
  totalSettled: number;
  currency: string | null;
};
type Summary = {
  thisMonthTotal: number;
  thisMonthCurrency: string | null;
  thisMonthMySpend: number;
  totalMySpend: number;
  totalBillsCreated: number;
  totalFriends: number;
  totalSettled: number;
  settledCurrency: string | null;
};
type AnalyticsData = {
  monthlySpending: MonthlyEntry[];
  monthlyMySpend: MonthlyEntry[];
  topFriends: TopFriend[];
  summary: Summary;
};

type ViewMode = "all_bills" | "my_spend";

function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  const d = new Date(parseInt(year), parseInt(month) - 1, 1);
  return d.toLocaleDateString(undefined, { month: "short" });
}

// Custom tooltip for the bar chart
function CustomTooltip({ active, payload, label, displayCurrency, viewMode }: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  displayCurrency: string;
  viewMode: ViewMode;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 shadow text-sm">
      <p className="font-medium text-slate-700 dark:text-slate-200">{label}</p>
      <p className={viewMode === "my_spend" ? "text-violet-600 dark:text-violet-400" : "text-blue-600 dark:text-blue-400"}>
        {viewMode === "my_spend" ? "My spend: " : "Total: "}{formatAmount(payload[0].value, displayCurrency)}
      </p>
    </div>
  );
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [rates, setRates] = useState<Record<string, number> | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [isDark, setIsDark] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("all_bills");

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/analytics").then((r) => r.json()),
      fetch("/api/exchange-rates").then((r) => r.json()),
    ]).then(([analyticsJson, ratesJson]) => {
      if (analyticsJson.success) setData(analyticsJson.data);
      if (ratesJson.success) {
        setRates(ratesJson.data.rates);
        // Default display currency = most common in user's data
        if (analyticsJson.success) {
          const d = analyticsJson.data as AnalyticsData;
          const mc = d.summary.thisMonthCurrency ?? d.monthlySpending.find((m: MonthlyEntry) => m.total > 0)?.currency;
          if (mc) setDisplayCurrency(mc);
        }
      }
    }).catch(() => null).finally(() => setLoading(false));
  }, []);

  function convert(amount: number, from: string): number {
    if (!rates) return amount;
    return convertAmount(amount, from, displayCurrency, rates);
  }

  // Build chart data with conversion
  const activeMonthly = viewMode === "my_spend"
    ? (data?.monthlyMySpend ?? [])
    : (data?.monthlySpending ?? []);

  const chartData = activeMonthly.map((m) => ({
    month: monthLabel(m.month),
    total: m.total > 0 ? convert(m.total, m.currency) : 0,
    billCount: m.billCount,
    hasData: m.total > 0,
  }));

  const maxTotal = Math.max(...chartData.map((d) => d.total), 1);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const s = data?.summary;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Analytics</h1>
        <Button variant="ghost" onClick={() => router.push(ROUTES.home)}>← Home</Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
          <p className="text-xs text-slate-400 mb-1">Bills This Month</p>
          <p className="text-xl font-bold text-slate-800 dark:text-slate-100">
            {s ? formatAmount(convert(s.thisMonthTotal, s.thisMonthCurrency ?? displayCurrency), displayCurrency) : "—"}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
          <p className="text-xs text-slate-400 mb-1">My Spend This Month</p>
          <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
            {s ? formatAmount(convert(s.thisMonthMySpend, s.thisMonthCurrency ?? displayCurrency), displayCurrency) : "—"}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
          <p className="text-xs text-slate-400 mb-1">Total Bills</p>
          <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{s?.totalBillsCreated ?? "—"}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
          <p className="text-xs text-slate-400 mb-1">Total Settled</p>
          <p className="text-xl font-bold text-slate-800 dark:text-slate-100">
            {s && s.totalSettled > 0
              ? formatAmount(convert(s.totalSettled, s.settledCurrency ?? displayCurrency), displayCurrency)
              : "—"}
          </p>
        </div>
      </div>

      {/* Monthly chart */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode("all_bills")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                viewMode === "all_bills"
                  ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              All Bills
            </button>
            <button
              onClick={() => setViewMode("my_spend")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                viewMode === "my_spend"
                  ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              My Spend
            </button>
          </div>
          {rates && (
            <select
              value={displayCurrency}
              onChange={(e) => setDisplayCurrency(e.target.value)}
              className="text-sm rounded-lg border border-slate-200 dark:border-slate-600 px-2 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {getCurrencySymbol(c.code)} {c.code}
                </option>
              ))}
            </select>
          )}
        </div>
        {chartData.every((d) => d.total === 0) ? (
          <p className="text-sm text-slate-400 text-center py-10">No spending data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barSize={32}>
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: isDark ? "#94a3b8" : "#64748b" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: isDark ? "#94a3b8" : "#64748b" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${getCurrencySymbol(displayCurrency)}${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
                width={50}
              />
              <Tooltip content={<CustomTooltip displayCurrency={displayCurrency} viewMode={viewMode} />} cursor={{ fill: "transparent" }} />
              <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={entry.hasData
                      ? (viewMode === "my_spend" ? "#8b5cf6" : "#3b82f6")
                      : (isDark ? "#334155" : "#e2e8f0")}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Top friends */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h2 className="font-semibold text-slate-700 dark:text-slate-200 mb-4">Top Friends by Shared Bills</h2>
        {!data?.topFriends.length ? (
          <p className="text-sm text-slate-400 text-center py-8">No shared bills with friends yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {data.topFriends.map((f) => {
              const settled = f.currency ? convert(f.totalSettled, f.currency) : f.totalSettled;
              const barPct = maxTotal > 0 ? Math.round((settled / maxTotal) * 100) : 0;
              return (
                <button
                  key={f.friendId}
                  onClick={() => router.push(ROUTES.friendDetail(f.friendId))}
                  className="flex items-center gap-3 group text-left w-full"
                >
                  {f.avatarUrl ? (
                    <img src={f.avatarUrl} alt="" referrerPolicy="no-referrer" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-300 font-semibold text-sm flex-shrink-0">
                      {f.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {f.displayName}
                      </span>
                      <span className="text-xs text-slate-400 flex-shrink-0 ml-2">
                        {f.sharedBillCount} bill{f.sharedBillCount !== 1 ? "s" : ""}
                        {settled > 0 ? ` · ${formatAmount(settled, displayCurrency)} settled` : ""}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5">
                      <div
                        className="h-1.5 bg-blue-500 rounded-full transition-all"
                        style={{ width: `${Math.max(barPct, settled > 0 ? 3 : 0)}%` }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
