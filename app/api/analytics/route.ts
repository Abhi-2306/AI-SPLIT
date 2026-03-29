import { createClient } from "@/lib/supabase/server";
import { successResponse, errorResponse, handleApiError } from "@/lib/utils/apiHelpers";

// GET /api/analytics
// Returns aggregated spending data for the current user.
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

    // ── 1. Bills created by this user (non-draft) ──────────────────────────
    const { data: bills } = await supabase
      .from("bills")
      .select("id, currency, created_at, tax, tip")
      .eq("user_id", user.id)
      .neq("status", "draft");

    // Get item subtotals for each bill
    const billIds = (bills ?? []).map((b) => b.id);
    const { data: itemRows } = billIds.length > 0
      ? await supabase
          .from("bill_items")
          .select("bill_id, quantity, unit_price")
          .in("bill_id", billIds)
      : { data: [] };

    // Build bill totals map
    const billTotals = new Map<string, number>();
    for (const row of itemRows ?? []) {
      const sub = (row.unit_price ?? 0) * (row.quantity ?? 1);
      billTotals.set(row.bill_id, (billTotals.get(row.bill_id) ?? 0) + sub);
    }

    // ── 2. Monthly spending — group by YYYY-MM ─────────────────────────────
    const monthMap = new Map<string, { total: number; currency: string; billCount: number }>();
    for (const bill of bills ?? []) {
      const month = bill.created_at.slice(0, 7); // "2026-03"
      const subtotal = billTotals.get(bill.id) ?? 0;
      const tax = bill.tax ?? 0;
      const tip = bill.tip ?? 0;
      const total = subtotal + tax + tip;
      const existing = monthMap.get(month);
      if (!existing) {
        monthMap.set(month, { total, currency: bill.currency, billCount: 1 });
      } else {
        // If same currency, sum. If mixed, keep first currency but still sum.
        existing.total += total;
        existing.billCount += 1;
      }
    }

    // Last 6 months, sorted ascending
    const now = new Date();
    const monthlySpending = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const entry = monthMap.get(key);
      monthlySpending.push({
        month: key,
        total: entry?.total ?? 0,
        currency: entry?.currency ?? "USD",
        billCount: entry?.billCount ?? 0,
      });
    }

    // ── 3. This month summary ──────────────────────────────────────────────
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const thisMonth = monthMap.get(thisMonthKey);

    // ── 4. Total settlements (all time) ───────────────────────────────────
    const { data: settledRows } = await supabase
      .from("settlements")
      .select("amount, currency")
      .eq("from_user", user.id);

    let totalSettled = 0;
    let settledCurrency: string | null = null;
    for (const s of settledRows ?? []) {
      if (settledCurrency === null) settledCurrency = s.currency;
      if (s.currency === settledCurrency) totalSettled += Number(s.amount);
    }

    // ── 5. Friends + shared bill counts ───────────────────────────────────
    const { data: friendships } = await supabase
      .from("friendships")
      .select("user_a, user_b")
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);

    const friendIds = (friendships ?? []).map((f) =>
      f.user_a === user.id ? f.user_b : f.user_a
    );

    // Get my participant bill_ids
    const { data: myParticipantRows } = await supabase
      .from("participants")
      .select("bill_id")
      .eq("user_id", user.id);
    const myBillIds = new Set((myParticipantRows ?? []).map((r) => r.bill_id));

    // For each friend, count bills where they also appear
    const friendDataList: Array<{
      friendId: string;
      sharedBillCount: number;
      totalSettled: number;
      settledCurrency: string | null;
    }> = [];

    for (const friendId of friendIds) {
      const { data: friendParticipantRows } = await supabase
        .from("participants")
        .select("bill_id")
        .eq("user_id", friendId);
      const friendBillIds = new Set((friendParticipantRows ?? []).map((r) => r.bill_id));
      const sharedCount = [...myBillIds].filter((id) => friendBillIds.has(id)).length;

      const { data: sRows } = await supabase
        .from("settlements")
        .select("amount, currency")
        .or(
          `and(from_user.eq.${user.id},to_user.eq.${friendId}),and(from_user.eq.${friendId},to_user.eq.${user.id})`
        );
      let fSettled = 0;
      let fCurrency: string | null = null;
      for (const s of sRows ?? []) {
        if (fCurrency === null) fCurrency = s.currency;
        if (s.currency === fCurrency) fSettled += Number(s.amount);
      }

      if (sharedCount > 0 || fSettled > 0) {
        friendDataList.push({
          friendId,
          sharedBillCount: sharedCount,
          totalSettled: fSettled,
          settledCurrency: fCurrency,
        });
      }
    }

    // Sort by shared bill count desc, take top 5
    friendDataList.sort((a, b) => b.sharedBillCount - a.sharedBillCount);
    const topFriendIds = friendDataList.slice(0, 5).map((f) => f.friendId);

    // Resolve display names
    let profiles: Array<{ id: string; display_name: string; avatar_url: string | null }> = [];
    if (topFriendIds.length > 0) {
      const { data } = await supabase.rpc("get_users_display_info", { user_ids: topFriendIds });
      profiles = (data as typeof profiles) ?? [];
    }
    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    const topFriends = friendDataList.slice(0, 5).map((f) => ({
      friendId: f.friendId,
      displayName: profileMap.get(f.friendId)?.display_name ?? "Unknown",
      avatarUrl: profileMap.get(f.friendId)?.avatar_url ?? null,
      sharedBillCount: f.sharedBillCount,
      totalSettled: f.totalSettled,
      currency: f.settledCurrency,
    }));

    return successResponse({
      monthlySpending,
      topFriends,
      summary: {
        thisMonthTotal: thisMonth?.total ?? 0,
        thisMonthCurrency: thisMonth?.currency ?? null,
        totalBillsCreated: (bills ?? []).length,
        totalFriends: friendIds.length,
        totalSettled,
        settledCurrency,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
