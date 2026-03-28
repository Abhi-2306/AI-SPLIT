import { NextRequest } from "next/server";
import { z } from "zod";
import { container } from "@/composition-root/container";
import { successResponse, handleApiError } from "@/lib/utils/apiHelpers";
import { createClient } from "@/lib/supabase/server";

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

    // Log bill_shared for the linked user so they see this bill in their activity
    // even after the bill is deleted (persistent log vs. live table query)
    if (input.userId) {
      try {
        const supabase = await createClient();
        const { data: bill } = await supabase
          .from("bills")
          .select("title, currency, user_id")
          .eq("id", billId)
          .single();
        // Don't log bill_shared for the creator — they already have bill_created
        if (bill && bill.user_id !== input.userId) {
          await supabase.from("activity_log").insert({
            user_id: input.userId,
            event_type: "bill_shared",
            bill_id: billId,
            bill_title: bill.title,
            currency: bill.currency,
          });

        }
      } catch {
        // Non-fatal
      }
    }

    return successResponse(participant, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
