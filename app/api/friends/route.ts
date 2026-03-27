import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { successResponse, errorResponse, handleApiError } from "@/lib/utils/apiHelpers";

// GET /api/friends — list friends with their profiles
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

    const { data: friendships, error } = await supabase
      .from("friendships")
      .select("id, user_a, user_b, created_at")
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);

    if (error) throw error;

    // Collect the friend IDs
    const friendIds = (friendships ?? []).map((f) =>
      f.user_a === user.id ? f.user_b : f.user_a
    );

    if (friendIds.length === 0) {
      return successResponse([]);
    }

    const { data: profiles, error: profilesError } = await supabase
      .rpc("get_users_display_info", { user_ids: friendIds });

    if (profilesError) throw profilesError;

    type ProfileRow = { id: string; display_name: string; avatar_url: string | null };
    const rows = (profiles ?? []) as ProfileRow[];
    const profileMap = new Map(rows.map((p) => [p.id, p]));

    const friends = (friendships ?? []).map((f) => {
      const friendId = f.user_a === user.id ? f.user_b : f.user_a;
      const profile = profileMap.get(friendId);
      return {
        friendshipId: f.id,
        userId: friendId,
        displayName: profile?.display_name ?? "Unknown",
        avatarUrl: profile?.avatar_url ?? null,
        since: f.created_at,
      };
    });

    return successResponse(friends);
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/friends — send friend request by email
const SendRequestSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

    const body = await request.json();
    const { email } = SendRequestSchema.parse(body);

    if (email.toLowerCase() === user.email?.toLowerCase()) {
      return errorResponse("INVALID_REQUEST", "Cannot add yourself", 400);
    }

    // Look up the target user by email via profiles (server-side, no RLS restriction needed)
    // We use the admin client implicitly since this runs server-side with service role OR
    // we look up via auth.users using a service role — but we only have anon key here.
    // Instead, we store emails in profiles via a lookup function.
    // Workaround: query auth.users via a SECURITY DEFINER RPC.
    const { data: targetData, error: lookupError } = await supabase
      .rpc("get_user_id_by_email", { target_email: email });

    if (lookupError || !targetData) {
      return errorResponse("USER_NOT_FOUND", "No account found with that email", 404);
    }

    const toUser: string = targetData;

    // Check if already friends
    const a = user.id < toUser ? user.id : toUser;
    const b = user.id < toUser ? toUser : user.id;
    const { data: existing } = await supabase
      .from("friendships")
      .select("id")
      .eq("user_a", a)
      .eq("user_b", b)
      .maybeSingle();

    if (existing) {
      return errorResponse("ALREADY_FRIENDS", "You are already friends", 400);
    }

    // Check for existing pending request
    const { data: existingReq } = await supabase
      .from("friend_requests")
      .select("id, status")
      .eq("from_user", user.id)
      .eq("to_user", toUser)
      .maybeSingle();

    if (existingReq?.status === "pending") {
      return errorResponse("REQUEST_ALREADY_SENT", "Friend request already sent", 400);
    }

    const { data: req, error: insertError } = await supabase
      .from("friend_requests")
      .upsert({ from_user: user.id, to_user: toUser, status: "pending", updated_at: new Date().toISOString() }, { onConflict: "from_user,to_user" })
      .select()
      .single();

    if (insertError) throw insertError;

    return successResponse({ id: req.id, status: "pending" }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
