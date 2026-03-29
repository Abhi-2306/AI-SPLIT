import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { successResponse, errorResponse, handleApiError } from "@/lib/utils/apiHelpers";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// POST /api/profile/avatar — upload a new profile picture
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) return errorResponse("BAD_REQUEST", "No file provided", 400);
    if (!ALLOWED_TYPES.includes(file.type)) {
      return errorResponse("BAD_REQUEST", "File must be a JPEG, PNG, WebP, or GIF", 400);
    }
    if (file.size > MAX_SIZE_BYTES) {
      return errorResponse("BAD_REQUEST", "File must be under 5 MB", 400);
    }

    const ext = file.type.split("/")[1].replace("jpeg", "jpg");
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);

    // Bust cache by appending a timestamp query param
    const avatarUrl = `${publicUrl}?t=${Date.now()}`;

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({ id: user.id, avatar_url: avatarUrl, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (profileError) throw profileError;

    return successResponse({ avatarUrl });
  } catch (error) {
    return handleApiError(error);
  }
}
