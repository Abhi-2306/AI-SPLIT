import { createClient } from "@/lib/supabase/server";
import { errorResponse, handleApiError, successResponse } from "@/lib/utils/apiHelpers";

export type ActivityItem = {
  id: string;
  type: "bill_created" | "bill_shared" | "friend_added";
  createdAt: string;
  billId?: string;
  billTitle?: string;
  currency?: string;
  totalAmount?: number;
  participantCount?: number;
  isOwner?: boolean;
  friendName?: string;
  friendAvatarUrl?: string | null;
};

// GET /api/activity
// Returns recent activity for the current user: bills they created or were added to,
// and new friendships. Sorted newest first.
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

    // Fetch bills (RLS handles access: creator + linked participants see the bill)
    // and recent friendships in parallel
    const [billsResult, friendshipsResult] = await Promise.all([
      supabase
        .from("bills")
        .select("id, title, currency, status, created_at, user_id, tax, tip")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("friendships")
        .select("id, user_a, user_b, created_at")
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    if (billsResult.error) throw billsResult.error;
    if (friendshipsResult.error) throw friendshipsResult.error;

    const billRows = billsResult.data ?? [];
    const billIds = billRows.map((b) => b.id);

    // Batch fetch participant counts and item totals for all bills
    const [participantsResult, itemsResult] = await Promise.all([
      billIds.length > 0
        ? supabase.from("participants").select("bill_id").in("bill_id", billIds)
        : Promise.resolve({ data: [] as { bill_id: string }[], error: null }),
      billIds.length > 0
        ? supabase
            .from("bill_items")
            .select("bill_id, unit_price, quantity")
            .in("bill_id", billIds)
        : Promise.resolve({ data: [] as { bill_id: string; unit_price: number; quantity: number }[], error: null }),
    ]);

    const participantCounts: Record<string, number> = {};
    (participantsResult.data ?? []).forEach((p) => {
      participantCounts[p.bill_id] = (participantCounts[p.bill_id] ?? 0) + 1;
    });

    const itemSubtotals: Record<string, number> = {};
    (itemsResult.data ?? []).forEach((item) => {
      itemSubtotals[item.bill_id] =
        (itemSubtotals[item.bill_id] ?? 0) + Number(item.unit_price) * item.quantity;
    });

    // Resolve friend display names for friendship events
    const friendIds = (friendshipsResult.data ?? []).map((f) =>
      f.user_a === user.id ? f.user_b : f.user_a
    );

    type ProfileRow = { id: string; display_name: string; avatar_url: string | null };
    let profileMap = new Map<string, ProfileRow>();

    if (friendIds.length > 0) {
      const { data: profiles } = await supabase.rpc("get_users_display_info", {
        user_ids: friendIds,
      });
      const rows = (profiles ?? []) as ProfileRow[];
      profileMap = new Map(rows.map((p) => [p.id, p]));
    }

    const items: ActivityItem[] = [];

    for (const bill of billRows) {
      const isOwner = bill.user_id === user.id;
      const totalAmount =
        (itemSubtotals[bill.id] ?? 0) +
        (Number(bill.tax) || 0) +
        (Number(bill.tip) || 0);

      items.push({
        id: `bill-${bill.id}`,
        type: isOwner ? "bill_created" : "bill_shared",
        createdAt: bill.created_at,
        billId: bill.id,
        billTitle: bill.title,
        currency: bill.currency,
        totalAmount,
        participantCount: participantCounts[bill.id] ?? 0,
        isOwner,
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
