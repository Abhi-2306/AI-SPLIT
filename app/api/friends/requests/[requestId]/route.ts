import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { successResponse, errorResponse, handleApiError } from "@/lib/utils/apiHelpers";
import { sendEmail, friendAcceptedEmailHtml } from "@/lib/email";

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

      // Email the requester (non-fatal)
      try {
        const { data: reqRow } = await supabase
          .from("friend_requests").select("from_user").eq("id", requestId).single();
        if (reqRow) {
          const admin = createAdminClient();
          const [senderRes, acceptorProfile] = await Promise.all([
            admin.auth.admin.getUserById(reqRow.from_user),
            supabase.rpc("get_users_display_info", { user_ids: [user.id] }),
          ]);
          const senderEmail = senderRes.data.user?.email;
          const acceptorName = (acceptorProfile.data as { display_name: string }[] | null)?.[0]?.display_name ?? "Someone";
          if (senderEmail) {
            await sendEmail(
              senderEmail,
              `${acceptorName} accepted your friend request`,
              friendAcceptedEmailHtml(acceptorName)
            );
          }
        }
      } catch { /* Non-fatal */ }

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
