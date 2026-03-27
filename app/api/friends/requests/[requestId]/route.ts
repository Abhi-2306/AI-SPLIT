import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { successResponse, errorResponse, handleApiError } from "@/lib/utils/apiHelpers";

type Params = { params: Promise<{ requestId: string }> };

const ActionSchema = z.object({
  action: z.enum(["accept", "reject"]),
});

// PATCH /api/friends/requests/[requestId] — accept or reject
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

    const { requestId } = await params;
    const body = await request.json();
    const { action } = ActionSchema.parse(body);

    if (action === "accept") {
      const { error } = await supabase.rpc("accept_friend_request", {
        request_id: requestId,
      });
      if (error) {
        if (error.message.includes("not found")) {
          return errorResponse("NOT_FOUND", "Request not found or not pending", 404);
        }
        throw error;
      }
      return successResponse({ status: "accepted" });
    } else {
      const { error } = await supabase
        .from("friend_requests")
        .update({ status: "rejected", updated_at: new Date().toISOString() })
        .eq("id", requestId)
        .eq("to_user", user.id)
        .eq("status", "pending");

      if (error) throw error;
      return successResponse({ status: "rejected" });
    }
  } catch (error) {
    return handleApiError(error);
  }
}
