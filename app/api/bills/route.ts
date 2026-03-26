import { NextRequest } from "next/server";
import { z } from "zod";
import { container } from "@/composition-root/container";
import { successResponse, errorResponse, handleApiError } from "@/lib/utils/apiHelpers";
import { createClient } from "@/lib/supabase/server";

const CreateBillSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  currency: z.string().min(1, "Currency is required"),
});

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

    const { data: billRows, error } = await supabase
      .from("bills")
      .select("id, title, currency, status, tax, tip, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;

    if (!billRows || billRows.length === 0) return successResponse([]);

    const billIds = billRows.map((b) => b.id);

    const [participantResult, itemResult] = await Promise.all([
      supabase.from("participants").select("bill_id").in("bill_id", billIds),
      supabase.from("bill_items").select("bill_id, unit_price, quantity").in("bill_id", billIds),
    ]);

    const participantCounts: Record<string, number> = {};
    (participantResult.data ?? []).forEach((p) => {
      participantCounts[p.bill_id] = (participantCounts[p.bill_id] ?? 0) + 1;
    });

    const subtotals: Record<string, number> = {};
    (itemResult.data ?? []).forEach((item) => {
      subtotals[item.bill_id] =
        (subtotals[item.bill_id] ?? 0) + Number(item.unit_price) * item.quantity;
    });

    const summaries = billRows.map((b) => ({
      id: b.id,
      title: b.title,
      currency: b.currency,
      status: b.status,
      participantCount: participantCounts[b.id] ?? 0,
      total: (subtotals[b.id] ?? 0) + (Number(b.tax) || 0) + (Number(b.tip) || 0),
      createdAt: b.created_at,
    }));

    return successResponse(summaries);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = CreateBillSchema.parse(body);
    const bill = await container.createBill.execute(input);
    return successResponse(bill, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
