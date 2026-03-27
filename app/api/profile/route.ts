import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { successResponse, errorResponse, handleApiError } from "@/lib/utils/apiHelpers";

// GET /api/profile — current user's profile
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    const displayName =
      (profile?.display_name && profile.display_name.trim()) ||
      user.email?.split("@")[0] ||
      "User";

    return successResponse({
      id: user.id,
      email: user.email ?? "",
      displayName,
      avatarUrl: profile?.avatar_url ?? null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH /api/profile — update display name
const PatchSchema = z.object({
  displayName: z.string().min(1).max(50).trim(),
});

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

    const body = await request.json();
    const { displayName } = PatchSchema.parse(body);

    const { error } = await supabase
      .from("profiles")
      .upsert({ id: user.id, display_name: displayName, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (error) throw error;

    return successResponse({ displayName });
  } catch (error) {
    return handleApiError(error);
  }
}
