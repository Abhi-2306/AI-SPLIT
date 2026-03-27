import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { successResponse, errorResponse, handleApiError } from "@/lib/utils/apiHelpers";

type Params = { params: Promise<{ friendId: string }> };

const SettleSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  currency: z.string().min(1),
  note: z.string().optional(),
  // "i_paid": current user paid the friend  → from=me, to=friend
  // "they_paid": friend paid current user   → from=friend, to=me
  direction: z.enum(["i_paid", "they_paid"]),
});

// POST /api/friends/[friendId]/settle
// Records a manual payment between the current user and a friend.
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

    const { friendId } = await params;
    const body = await request.json();
    const { amount, currency, note, direction } = SettleSchema.parse(body);

    const from_user = direction === "i_paid" ? user.id : friendId;
    const to_user = direction === "i_paid" ? friendId : user.id;

    const { data, error } = await supabase
      .from("settlements")
      .insert({ from_user, to_user, amount, currency, note: note || null })
      .select()
      .single();

    if (error) throw error;

    return successResponse(
      {
        id: data.id,
        amount: data.amount,
        currency: data.currency,
        direction,
        settledAt: data.settled_at,
      },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}
