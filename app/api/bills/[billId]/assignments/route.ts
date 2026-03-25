import { NextRequest } from "next/server";
import { z } from "zod";
import { container } from "@/composition-root/container";
import { successResponse, handleApiError } from "@/lib/utils/apiHelpers";

type Params = { params: Promise<{ billId: string }> };

const AssignSchema = z.object({
  itemId: z.string().min(1),
  participantId: z.string().min(1),
  unitIndex: z.number().int().min(0),
});

const UnassignSchema = z.object({
  itemId: z.string().min(1),
  participantId: z.string().min(1),
  unitIndex: z.number().int().min(0),
});

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { billId } = await params;
    const body = await request.json();
    const input = AssignSchema.parse(body);
    const assignment = await container.assignItem.execute({ billId, ...input });
    return successResponse(assignment, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { billId } = await params;
    const body = await request.json();
    const input = UnassignSchema.parse(body);
    await container.unassignItem.execute({ billId, ...input });
    return successResponse({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
