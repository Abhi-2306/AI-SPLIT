import { NextRequest } from "next/server";
import { container } from "@/composition-root/container";
import { successResponse, handleApiError } from "@/lib/utils/apiHelpers";

type Params = { params: Promise<{ billId: string; participantId: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { billId, participantId } = await params;
    await container.removeParticipant.execute({ billId, participantId });
    return successResponse({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
