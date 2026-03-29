import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { successResponse, errorResponse, handleApiError } from "@/lib/utils/apiHelpers";

type Params = { params: Promise<{ templateId: string }> };

// DELETE /api/templates/[templateId]
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

    const { templateId } = await params;

    // RLS ensures user can only delete their own templates; cascade deletes participants
    const { error } = await supabase
      .from("bill_templates")
      .delete()
      .eq("id", templateId)
      .eq("user_id", user.id);

    if (error) throw error;
    return successResponse({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
