import { NextRequest } from "next/server";
import { z } from "zod";
import { container } from "@/composition-root/container";
import { successResponse, handleApiError } from "@/lib/utils/apiHelpers";

type Params = { params: Promise<{ billId: string; itemId: string }> };

const SplitEntrySchema = z.object({
  participantId: z.string(),
  value: z.number(),
});

const SplitConfigSchema = z.object({
  mode: z.enum(["equally", "by_count", "by_percentage", "by_shares", "by_amount"]),
  entries: z.array(SplitEntrySchema),
}).nullable();

const UpdateItemSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  quantity: z.number().int().min(1).optional(),
  unitPrice: z.number().min(0).optional(),
  notes: z.string().max(200).nullable().optional(),
  splitConfig: SplitConfigSchema.optional(),
});

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { billId, itemId } = await params;
    const body = await request.json();
    const input = UpdateItemSchema.parse(body);
    const item = await container.updateBillItem.execute({ billId, itemId, ...input });
    return successResponse(item);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { billId, itemId } = await params;
    await container.deleteBillItem.execute({ billId, itemId });
    return successResponse({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
