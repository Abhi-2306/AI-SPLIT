import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { successResponse, errorResponse, handleApiError } from "@/lib/utils/apiHelpers";

type Params = { params: Promise<{ friendId: string }> };

// GET /api/friends/[friendId]/profile
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

    const { friendId } = await params;

    // Verify this is actually a friend
    const { data: friendship } = await supabase
      .from("friendships")
      .select("user_a, user_b")
      .or(`and(user_a.eq.${user.id},user_b.eq.${friendId}),and(user_a.eq.${friendId},user_b.eq.${user.id})`)
      .single();

    if (!friendship) return errorResponse("NOT_FOUND", "Friend not found", 404);

    const { data: profiles } = await supabase.rpc("get_users_display_info", {
      user_ids: [friendId],
    });

    const profile = (profiles as { id: string; display_name: string; avatar_url: string | null }[] | null)?.[0];
    if (!profile) return errorResponse("NOT_FOUND", "Profile not found", 404);

    return successResponse({
      displayName: profile.display_name,
      avatarUrl: profile.avatar_url,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
