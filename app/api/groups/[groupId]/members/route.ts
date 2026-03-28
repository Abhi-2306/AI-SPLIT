import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { successResponse, errorResponse, handleApiError } from "@/lib/utils/apiHelpers";

type Params = { params: Promise<{ groupId: string }> };
const AddMemberSchema = z.object({ userId: z.string().uuid() });

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

    const { groupId } = await params;

    const { data, error } = await supabase
      .from("group_members")
      .select("user_id, joined_at")
      .eq("group_id", groupId)
      .order("joined_at", { ascending: true });
    if (error) throw error;

    const rows = data ?? [];
    const userIds = rows.map((m) => m.user_id);

    type ProfileRow = { id: string; display_name: string; avatar_url: string | null };
    let profileMap = new Map<string, ProfileRow>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.rpc("get_users_display_info", { user_ids: userIds });
      ((profiles ?? []) as ProfileRow[]).forEach((p) => profileMap.set(p.id, p));
    }

    return successResponse(
      rows.map((m) => {
        const profile = profileMap.get(m.user_id);
        return {
          userId: m.user_id,
          displayName: profile?.display_name ?? "Unknown",
          avatarUrl: profile?.avatar_url ?? null,
          joinedAt: m.joined_at,
          isMe: m.user_id === user.id,
        };
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

    const { groupId } = await params;
    const body = await request.json();
    const { userId } = AddMemberSchema.parse(body);

    const { data: group } = await supabase.from("groups").select("created_by").eq("id", groupId).single();
    if (!group) return errorResponse("NOT_FOUND", "Group not found", 404);
    if (group.created_by !== user.id) return errorResponse("FORBIDDEN", "Only the creator can add members", 403);

    const { error } = await supabase.from("group_members").insert({ group_id: groupId, user_id: userId });
    if (error) {
      if (error.code === "23505") return errorResponse("ALREADY_MEMBER", "Already a member", 409);
      throw error;
    }

    return successResponse({ added: true }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/groups/[groupId]/members?userId=xxx
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

    const { groupId } = await params;
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get("userId");
    if (!targetUserId) return errorResponse("BAD_REQUEST", "userId required", 400);

    const { data: group } = await supabase.from("groups").select("created_by").eq("id", groupId).single();
    if (!group) return errorResponse("NOT_FOUND", "Group not found", 404);

    // Creator can remove anyone; members can only remove themselves
    if (group.created_by !== user.id && targetUserId !== user.id) {
      return errorResponse("FORBIDDEN", "Not allowed", 403);
    }

    const { error } = await supabase.from("group_members")
      .delete().eq("group_id", groupId).eq("user_id", targetUserId);
    if (error) throw error;

    return successResponse({ removed: true });
  } catch (error) {
    return handleApiError(error);
  }
}
