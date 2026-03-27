import { NextRequest } from "next/server";
import { z } from "zod";
import { container } from "@/composition-root/container";
import { successResponse, errorResponse, handleApiError } from "@/lib/utils/apiHelpers";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ billId: string }> };

const UpdateBillSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  tax: z.number().min(0).nullable().optional(),
  tip: z.number().min(0).nullable().optional(),
  paidByParticipantId: z.string().nullable().optional(),
});

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { billId } = await params;
    const bill = await container.getBill.execute(billId);
    if (!bill) return errorResponse("BILL_NOT_FOUND", `Bill "${billId}" not found`, 404);
    return successResponse(bill);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { billId } = await params;
    const body = await request.json();
    const input = UpdateBillSchema.parse(body);
    const bill = await container.updateBillMeta.execute({ billId, ...input });
    return successResponse(bill);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

    const { billId } = await params;
    const { data: bill, error: fetchErr } = await supabase
      .from("bills").select("user_id").eq("id", billId).single();
    if (fetchErr || !bill) return errorResponse("BILL_NOT_FOUND", "Bill not found", 404);
    if (bill.user_id !== user.id) return errorResponse("FORBIDDEN", "Not your bill", 403);

    const { error } = await supabase.from("bills").delete().eq("id", billId);
    if (error) throw error;

    return successResponse({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
