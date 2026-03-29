import { successResponse, handleApiError } from "@/lib/utils/apiHelpers";

// GET /api/exchange-rates
// Proxies open.er-api.com (free, no API key). Cached for 1 hour via Next.js fetch cache.
export async function GET() {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error("Exchange rate API unavailable");
    const data = await res.json();
    return successResponse({
      base: "USD",
      rates: data.rates as Record<string, number>,
      updatedAt: data.time_last_update_utc as string,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
