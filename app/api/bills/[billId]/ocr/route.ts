import { NextRequest } from "next/server";
import { container } from "@/composition-root/container";
import { successResponse, errorResponse, handleApiError } from "@/lib/utils/apiHelpers";
import { MAX_UPLOAD_SIZE_BYTES, SUPPORTED_RECEIPT_TYPES, OCR_DAILY_LIMIT } from "@/lib/constants/config";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ billId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    await params;

    // Auth check — API routes are not protected by middleware
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

    // Bypass list: test / admin users skip the limit
    // Set OCR_BYPASS_USER_IDS="id1,id2" in .env.local or Vercel env vars
    const bypassIds = (process.env.OCR_BYPASS_USER_IDS ?? "").split(",").filter(Boolean);
    const isExempt = bypassIds.includes(user.id);

    if (!isExempt) {
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);

      const { count, error: countErr } = await supabase
        .from("ocr_usage")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("used_at", startOfDay.toISOString());

      if (countErr) throw countErr;

      if ((count ?? 0) >= OCR_DAILY_LIMIT) {
        return errorResponse(
          "OCR_LIMIT_EXCEEDED",
          `Daily scan limit reached (${OCR_DAILY_LIMIT}/day). Resets at midnight UTC. You can still add items manually.`,
          429
        );
      }
    }

    const formData = await request.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return errorResponse("MISSING_IMAGE", "No image file provided", 400);
    }

    if (!SUPPORTED_RECEIPT_TYPES.includes(file.type)) {
      return errorResponse(
        "UNSUPPORTED_FILE_TYPE",
        `File type "${file.type}" is not supported. Use JPEG, PNG, WebP, or PDF.`,
        400
      );
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return errorResponse("FILE_TOO_LARGE", `File size exceeds the 10MB limit.`, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    const result = await container.processReceiptOcr.execute({
      imageBuffer,
      mimeType: file.type,
    });

    // Record usage after a successful scan (exempt users skip this)
    if (!isExempt) {
      await supabase.from("ocr_usage").insert({ user_id: user.id });
    }

    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
