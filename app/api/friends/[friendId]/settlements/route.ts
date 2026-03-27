import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { successResponse, errorResponse, handleApiError } from "@/lib/utils/apiHelpers";

type Params = { params: Promise<{ friendId: string }> };

// GET /api/friends/[friendId]/settlements
// Returns all recorded payments between the current user and a friend, newest first.
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

    const { friendId } = await params;

    const { data, error } = await supabase
      .from("settlements")
      .select("id, from_user, to_user, amount, currency, note, settled_at")
      .or(
        `and(from_user.eq.${user.id},to_user.eq.${friendId}),and(from_user.eq.${friendId},to_user.eq.${user.id})`
      )
      .order("settled_at", { ascending: false });

    if (error) throw error;

    const settlements = (data ?? []).map((s) => ({
      id: s.id,
      amount: Number(s.amount),
      currency: s.currency,
      note: s.note ?? null,
      settledAt: s.settled_at,
      paidByMe: s.from_user === user.id,
    }));

    return successResponse(settlements);
  } catch (error) {
    return handleApiError(error);
  }
}
