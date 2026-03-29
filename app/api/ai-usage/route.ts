import { createClient } from "@/lib/supabase/server";
import { errorResponse, handleApiError, successResponse } from "@/lib/utils/apiHelpers";
import { AI_DAILY_LIMIT } from "@/lib/constants/config";

// GET /api/ai-usage
// Returns today's AI suggestion count for the current user.
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

    const bypassIds = (process.env.OCR_BYPASS_USER_IDS ?? "").split(",").filter(Boolean);
    if (bypassIds.includes(user.id)) {
      return successResponse({ used: 0, limit: 999, remaining: 999 });
    }

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const { count, error } = await supabase
      .from("ai_usage")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("used_at", startOfDay.toISOString());

    if (error) throw error;

    const used = count ?? 0;
    return successResponse({
      used,
      limit: AI_DAILY_LIMIT,
      remaining: Math.max(0, AI_DAILY_LIMIT - used),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
