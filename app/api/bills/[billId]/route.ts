import { NextRequest } from "next/server";
import { z } from "zod";
import { container } from "@/composition-root/container";
import { successResponse, errorResponse, handleApiError } from "@/lib/utils/apiHelpers";

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
