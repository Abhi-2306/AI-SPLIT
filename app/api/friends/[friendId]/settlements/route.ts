import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { successResponse, errorResponse, handleApiError } from "@/lib/utils/apiHelpers";

// DELETE /api/friends/[friendId]/settlements?id=<settlementId>
// Only the payer (from_user) can delete their own settlement record.
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

    const { searchParams } = new URL(request.url);
    const settlementId = searchParams.get("id");
    if (!settlementId) return errorResponse("BAD_REQUEST", "Missing settlement id", 400);

    // Verify ownership before deleting
    const { data: settlement } = await supabase
      .from("settlements")
      .select("from_user")
      .eq("id", settlementId)
      .single();

    if (!settlement) return errorResponse("NOT_FOUND", "Settlement not found", 404);
    if (settlement.from_user !== user.id) return errorResponse("FORBIDDEN", "Not your settlement", 403);

    const { error } = await supabase.from("settlements").delete().eq("id", settlementId);
    if (error) throw error;

    return successResponse({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}

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
