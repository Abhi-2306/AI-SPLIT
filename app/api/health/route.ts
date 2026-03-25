import { successResponse } from "@/lib/utils/apiHelpers";

export async function GET() {
  return successResponse({ status: "ok", timestamp: new Date().toISOString() });
}
