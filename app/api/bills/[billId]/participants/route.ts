import { NextRequest } from "next/server";
import { z } from "zod";
import { container } from "@/composition-root/container";
import { successResponse, handleApiError } from "@/lib/utils/apiHelpers";

type Params = { params: Promise<{ billId: string }> };

const AddParticipantSchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  userId: z.string().uuid().nullable().optional(),
});

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { billId } = await params;
    const body = await request.json();
    const input = AddParticipantSchema.parse(body);
    const participant = await container.addParticipant.execute({
      billId,
      name: input.name,
      userId: input.userId ?? null,
    });
    return successResponse(participant, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
