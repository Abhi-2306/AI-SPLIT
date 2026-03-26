import { NextRequest } from "next/server";
import { z } from "zod";
import { container } from "@/composition-root/container";
import { successResponse, handleApiError } from "@/lib/utils/apiHelpers";

type Params = { params: Promise<{ billId: string }> };

const BatchAddItemsSchema = z.object({
  items: z.array(
    z.object({
      name: z.string().min(1),
      quantity: z.number().int().min(1),
      unitPrice: z.number().min(0),
      notes: z.string().optional(),
    })
  ).min(1),
});

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { billId } = await params;
    const body = await request.json();
    const { items } = BatchAddItemsSchema.parse(body);
    const result = await container.batchAddItems.execute({ billId, items });
    return successResponse(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
