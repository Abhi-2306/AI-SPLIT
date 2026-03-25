import { NextRequest } from "next/server";
import { z } from "zod";
import { container } from "@/composition-root/container";
import { successResponse, handleApiError } from "@/lib/utils/apiHelpers";

type Params = { params: Promise<{ billId: string }> };

const AddItemSchema = z.object({
  name: z.string().min(1, "Item name is required").max(100),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  unitPrice: z.number().min(0, "Price cannot be negative"),
  notes: z.string().max(200).optional(),
});

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { billId } = await params;
    const body = await request.json();
    const input = AddItemSchema.parse(body);
    const item = await container.addBillItem.execute({ billId, ...input });
    return successResponse(item, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
