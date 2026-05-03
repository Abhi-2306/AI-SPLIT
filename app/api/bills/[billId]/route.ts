import { NextRequest } from "next/server";
import { z } from "zod";
import { container } from "@/composition-root/container";
import { successResponse, errorResponse, handleApiError } from "@/lib/utils/apiHelpers";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ billId: string }> };

const UpdateBillSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  tax: z.number().nullable().optional(),
  discount: z.number().min(0).nullable().optional(),
  tip: z.number().min(0).nullable().optional(),
  paidByParticipantId: z.string().nullable().optional(),
});

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { billId } = await params;
    const bill = await container.getBill.execute(billId);
    if (!bill) return errorResponse("BILL_NOT_FOUND", `Bill "${billId}" not found`, 404);
    return successResponse(bill);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { billId } = await params;
    const body = await request.json();
    const input = UpdateBillSchema.parse(body);
    const bill = await container.updateBillMeta.execute({ billId, ...input });
    return successResponse(bill);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

    const { billId } = await params;
    const { data: bill, error: fetchErr } = await supabase
      .from("bills").select("user_id").eq("id", billId).single();
    if (fetchErr || !bill) return errorResponse("BILL_NOT_FOUND", "Bill not found", 404);
    if (bill.user_id !== user.id) return errorResponse("FORBIDDEN", "Not your bill", 403);

    // Capture bill details BEFORE deletion for the activity log (non-fatal)
    try {
      const { data: billDetail } = await supabase
        .from("bills")
        .select("title, currency, tax, tip")
        .eq("id", billId)
        .single();

      const { data: itemRows } = await supabase
        .from("bill_items")
        .select("unit_price, quantity")
        .eq("bill_id", billId);

      const subtotal = (itemRows ?? []).reduce(
        (sum: number, i: { unit_price: number; quantity: number }) =>
          sum + Number(i.unit_price) * i.quantity,
        0
      );
      const total =
        subtotal + (Number(billDetail?.tax) || 0) + (Number(billDetail?.tip) || 0);

      // Fetch all linked participants (those with a userId) so we can notify them too
      const { data: participantRows } = await supabase
        .from("participants")
        .select("user_id")
        .eq("bill_id", billId)
        .not("user_id", "is", null);

      const participantUserIds = (participantRows ?? [])
        .map((p: { user_id: string }) => p.user_id)
        .filter((id: string) => id !== user.id); // exclude creator — handled below

      const logBase = {
        event_type: "bill_deleted",
        bill_id: billId,
        bill_title: billDetail?.title ?? "Deleted bill",
        currency: billDetail?.currency ?? "USD",
        total,
      };

      // Insert creator's entry first (always succeeds with own auth)
      await supabase.from("activity_log").insert({ ...logBase, user_id: user.id });

      // Insert participant entries separately — requires permissive INSERT RLS
      // (DROP POLICY "users can insert own activity"; CREATE POLICY "authenticated users can insert activity" FOR INSERT WITH CHECK (auth.uid() IS NOT NULL))
      if (participantUserIds.length > 0) {
        await supabase.from("activity_log").insert(
          participantUserIds.map((pid: string) => ({ ...logBase, user_id: pid }))
        );
      }
    } catch {
      // Non-fatal: activity log failure should not block deletion
    }

    const { error } = await supabase.from("bills").delete().eq("id", billId);
    if (error) throw error;

    return successResponse({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
