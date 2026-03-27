import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { successResponse, errorResponse, handleApiError } from "@/lib/utils/apiHelpers";

const CreateGroupSchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  memberIds: z.array(z.string().uuid()).optional(),
});

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

    const { data: groups, error } = await supabase
      .from("groups")
      .select("id, name, created_by, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;

    if (!groups || groups.length === 0) return successResponse([]);

    const groupIds = groups.map((g) => g.id);
    const { data: members } = await supabase
      .from("group_members")
      .select("group_id")
      .in("group_id", groupIds);

    const memberCounts: Record<string, number> = {};
    (members ?? []).forEach((m) => {
      memberCounts[m.group_id] = (memberCounts[m.group_id] ?? 0) + 1;
    });

    return successResponse(
      groups.map((g) => ({
        id: g.id,
        name: g.name,
        isOwner: g.created_by === user.id,
        memberCount: memberCounts[g.id] ?? 0,
        createdAt: g.created_at,
      }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

    const body = await request.json();
    const { name, memberIds } = CreateGroupSchema.parse(body);

    const { data: group, error } = await supabase
      .from("groups")
      .insert({ name, created_by: user.id })
      .select()
      .single();
    if (error) throw error;

    // Always include the creator as a member
    const uniqueMembers = Array.from(new Set([user.id, ...(memberIds ?? [])]));
    const toInsert = uniqueMembers.map((id) => ({ group_id: group.id, user_id: id }));
    const { error: memberErr } = await supabase.from("group_members").insert(toInsert);
    if (memberErr) throw memberErr;

    return successResponse(
      { id: group.id, name: group.name, isOwner: true, memberCount: toInsert.length, createdAt: group.created_at },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}
