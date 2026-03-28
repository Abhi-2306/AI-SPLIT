import { createClient } from "@/lib/supabase/server";
import { errorResponse, handleApiError, successResponse } from "@/lib/utils/apiHelpers";

export type ActivityItem = {
  id: string;
  type: "bill_created" | "bill_deleted" | "bill_shared" | "friend_added" | "settlement_paid";
  createdAt: string;
  billId?: string;
  billTitle?: string;
  currency?: string;
  totalAmount?: number;
  participantCount?: number;
  isOwner?: boolean;   // for settlements: true = I paid, false = I received
  friendName?: string;
  friendAvatarUrl?: string | null;
};

// GET /api/activity
// bill_created / bill_deleted — from activity_log (persisted, survives deletion)
// bill_shared — from live bills table (bills the user is a participant in but didn't create)
// friend_added — from friendships table
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

    const [activityResult, sharedBillsResult, friendshipsResult, settlementsResult] = await Promise.all([
      // Persistent log: bill_created and bill_deleted events
      supabase
        .from("activity_log")
        .select("id, event_type, bill_id, bill_title, currency, total, occurred_at")
        .eq("user_id", user.id)
        .order("occurred_at", { ascending: false })
        .limit(20),

      // Live bills where the user is a linked participant but not the creator
      supabase
        .from("participants")
        .select("bill_id, bills(id, title, currency, status, created_at, user_id, tax, tip)")
        .eq("user_id", user.id)
        .limit(20),

      supabase
        .from("friendships")
        .select("id, user_a, user_b, created_at")
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(10),

      // Settlements involving the current user (as payer or receiver)
      supabase
        .from("settlements")
        .select("id, from_user, to_user, amount, currency, note, settled_at")
        .or(`from_user.eq.${user.id},to_user.eq.${user.id}`)
        .order("settled_at", { ascending: false })
        .limit(20),
    ]);

    // If activity_log table doesn't exist yet, return empty gracefully
    if (activityResult.error) {
      if (activityResult.error.code === "42P01") return successResponse([]);
      throw activityResult.error;
    }
    if (friendshipsResult.error) throw friendshipsResult.error;

    // Collect all user IDs we need display names for (friends + settlement counterparties)
    const friendIds = (friendshipsResult.data ?? []).map((f) =>
      f.user_a === user.id ? f.user_b : f.user_a
    );
    const settlementCounterpartyIds = (settlementsResult.data ?? []).map((s) =>
      s.from_user === user.id ? s.to_user : s.from_user
    );
    const allProfileIds = [...new Set([...friendIds, ...settlementCounterpartyIds])];

    type ProfileRow = { id: string; display_name: string; avatar_url: string | null };
    let profileMap = new Map<string, ProfileRow>();

    if (allProfileIds.length > 0) {
      const { data: profiles } = await supabase.rpc("get_users_display_info", {
        user_ids: allProfileIds,
      });
      const rows = (profiles ?? []) as ProfileRow[];
      profileMap = new Map(rows.map((p) => [p.id, p]));
    }

    const items: ActivityItem[] = [];

    // Bill created/deleted from persistent log
    for (const row of activityResult.data ?? []) {
      items.push({
        id: `log-${row.id}`,
        type: row.event_type as ActivityItem["type"],
        createdAt: row.occurred_at,
        billId: row.bill_id ?? undefined,
        billTitle: row.bill_title ?? undefined,
        currency: row.currency ?? undefined,
        totalAmount: row.total != null ? Number(row.total) : undefined,
      });
    }

    // Track bill IDs already in the log (bill_created OR bill_shared) to avoid
    // double-counting with the live bills table query below
    const loggedBillIds = new Set(
      (activityResult.data ?? [])
        .filter((r) => r.event_type === "bill_created" || r.event_type === "bill_shared")
        .map((r) => r.bill_id)
        .filter(Boolean)
    );

    // Shared bills: bills the user is a participant in but didn't create
    type BillRow = {
      id: string;
      title: string;
      currency: string;
      status: string;
      created_at: string;
      user_id: string;
      tax: number | null;
      tip: number | null;
    };

    for (const row of sharedBillsResult.data ?? []) {
      const bill = row.bills as unknown as BillRow | null;
      if (!bill) continue;
      if (bill.user_id === user.id) continue; // skip own bills — covered by activity_log
      if (loggedBillIds.has(bill.id)) continue; // skip if already in log

      items.push({
        id: `shared-${bill.id}`,
        type: "bill_shared",
        createdAt: bill.created_at,
        billId: bill.id,
        billTitle: bill.title,
        currency: bill.currency,
      });
    }

    // Settlement events
    for (const s of settlementsResult.data ?? []) {
      const iPaid = s.from_user === user.id;
      const counterpartyId = iPaid ? s.to_user : s.from_user;
      const profile = profileMap.get(counterpartyId);
      items.push({
        id: `settlement-${s.id}`,
        type: "settlement_paid",
        createdAt: s.settled_at,
        totalAmount: Number(s.amount),
        currency: s.currency,
        isOwner: iPaid,
        friendName: profile?.display_name ?? "Unknown",
        friendAvatarUrl: profile?.avatar_url ?? null,
      });
    }

    for (const f of friendshipsResult.data ?? []) {
      const friendId = f.user_a === user.id ? f.user_b : f.user_a;
      const profile = profileMap.get(friendId);
      items.push({
        id: `friend-${f.id}`,
        type: "friend_added",
        createdAt: f.created_at,
        friendName: profile?.display_name ?? "Unknown",
        friendAvatarUrl: profile?.avatar_url ?? null,
      });
    }

    // Merge and sort newest first
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return successResponse(items.slice(0, 20));
  } catch (error) {
    return handleApiError(error);
  }
}
