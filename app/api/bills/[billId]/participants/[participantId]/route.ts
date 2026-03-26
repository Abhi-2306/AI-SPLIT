import { NextRequest } from "next/server";
import { z } from "zod";
import { container } from "@/composition-root/container";
import { successResponse, handleApiError } from "@/lib/utils/apiHelpers";

type Params = { params: Promise<{ billId: string; participantId: string }> };

const UpdateParticipantSchema = z.object({
  name: z.string().min(1).max(50),
});

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { billId, participantId } = await params;
    const body = await request.json();
    const { name } = UpdateParticipantSchema.parse(body);
    const participant = await container.updateParticipant.execute({ billId, participantId, name });
    return successResponse(participant);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { billId, participantId } = await params;
    await container.removeParticipant.execute({ billId, participantId });
    return successResponse({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
