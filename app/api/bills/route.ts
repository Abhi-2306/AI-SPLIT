import { NextRequest } from "next/server";
import { z } from "zod";
import { container } from "@/composition-root/container";
import { successResponse, handleApiError } from "@/lib/utils/apiHelpers";
import { SUPPORTED_CURRENCIES } from "@/lib/constants/config";

const CreateBillSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  currency: z.string().min(1, "Currency is required"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = CreateBillSchema.parse(body);
    const bill = await container.createBill.execute(input);
    return successResponse(bill, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
