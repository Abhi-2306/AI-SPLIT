import { createClient } from "@/lib/supabase/server";
import { successResponse, errorResponse, handleApiError } from "@/lib/utils/apiHelpers";

// GET /api/friends/requests — list incoming pending friend requests
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

    const { data: requests, error } = await supabase
      .from("friend_requests")
      .select("id, from_user, created_at")
      .eq("to_user", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const fromIds = (requests ?? []).map((r) => r.from_user);
    if (fromIds.length === 0) return successResponse([]);

    const { data: profiles, error: profilesError } = await supabase
      .rpc("get_users_display_info", { user_ids: fromIds });

    if (profilesError) throw profilesError;

    type ProfileRow = { id: string; display_name: string; avatar_url: string | null };
    const rows = (profiles ?? []) as ProfileRow[];
    const profileMap = new Map(rows.map((p) => [p.id, p]));

    const result = (requests ?? []).map((r) => {
      const profile = profileMap.get(r.from_user);
      return {
        id: r.id,
        fromUserId: r.from_user,
        displayName: profile?.display_name ?? "Unknown",
        avatarUrl: profile?.avatar_url ?? null,
        createdAt: r.created_at,
      };
    });

    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
