import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { successResponse, errorResponse, handleApiError } from "@/lib/utils/apiHelpers";

type Params = { params: Promise<{ groupId: string }> };

const RenameGroupSchema = z.object({ name: z.string().min(1).max(50) });

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

    const { groupId } = await params;
    const body = await request.json();
    const { name } = RenameGroupSchema.parse(body);

    const { data: group } = await supabase.from("groups").select("created_by").eq("id", groupId).single();
    if (!group) return errorResponse("NOT_FOUND", "Group not found", 404);
    if (group.created_by !== user.id) return errorResponse("FORBIDDEN", "Only the creator can rename this group", 403);

    const { error } = await supabase.from("groups").update({ name }).eq("id", groupId);
    if (error) throw error;

    return successResponse({ updated: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

    const { groupId } = await params;
    const { data: group } = await supabase.from("groups").select("created_by").eq("id", groupId).single();
    if (!group) return errorResponse("NOT_FOUND", "Group not found", 404);
    if (group.created_by !== user.id) return errorResponse("FORBIDDEN", "Only the creator can delete this group", 403);

    const { error } = await supabase.from("groups").delete().eq("id", groupId);
    if (error) throw error;

    return successResponse({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
