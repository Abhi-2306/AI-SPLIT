import { NextRequest } from "next/server";
import { container } from "@/composition-root/container";
import { successResponse, handleApiError } from "@/lib/utils/apiHelpers";

type Params = { params: Promise<{ billId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { billId } = await params;
    const result = await container.calculateSplit.execute(billId);
    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
