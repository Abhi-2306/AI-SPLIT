import { NextRequest } from "next/server";
import { container } from "@/composition-root/container";
import { successResponse, errorResponse, handleApiError } from "@/lib/utils/apiHelpers";
import { MAX_UPLOAD_SIZE_BYTES, SUPPORTED_RECEIPT_TYPES } from "@/lib/constants/config";

type Params = { params: Promise<{ billId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    await params; // Ensure bill context (billId available for future validation)

    const formData = await request.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return errorResponse("MISSING_IMAGE", "No image file provided", 400);
    }

    if (!SUPPORTED_RECEIPT_TYPES.includes(file.type)) {
      return errorResponse(
        "UNSUPPORTED_FILE_TYPE",
        `File type "${file.type}" is not supported. Use JPEG, PNG, WebP, or PDF.`,
        400
      );
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return errorResponse(
        "FILE_TOO_LARGE",
        `File size exceeds the 10MB limit.`,
        400
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    const result = await container.processReceiptOcr.execute({
      imageBuffer,
      mimeType: file.type,
    });

    return successResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
