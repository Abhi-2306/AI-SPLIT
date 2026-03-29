import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { container } from "@/composition-root/container";
import { successResponse, errorResponse, handleApiError } from "@/lib/utils/apiHelpers";

type Params = { params: Promise<{ billId: string }> };

// GET /api/bills/[billId]/suggest-patterns
// Looks at past bills shared with the same group and recommends the most common split mode.
// No Groq — pure DB query + aggregation.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

    const { billId } = await params;
    const bill = await container.getBill.execute(billId);
    if (!bill) return errorResponse("NOT_FOUND", "Bill not found", 404);

    // Only suggest if at least 2 participants have linked userId
    const linkedParticipants = bill.participants.filter((p) => p.userId);
    if (linkedParticipants.length < 2) {
      return successResponse({ suggestedMode: null, confidence: 0 });
    }

    const linkedUserIds = linkedParticipants.map((p) => p.userId as string);

    // Find all bills where ALL of these userIds appear as participants
    // Strategy: for each userId, get the set of bill_ids they appear in, then intersect
    const participantSets = await Promise.all(
      linkedUserIds.map((uid) =>
        supabase
          .from("participants")
          .select("bill_id")
          .eq("user_id", uid)
          .neq("bill_id", billId) // exclude current bill
          .then(({ data }) => new Set((data ?? []).map((r) => r.bill_id as string)))
      )
    );

    // Intersection of all sets
    let sharedBillIds = participantSets[0];
    for (let i = 1; i < participantSets.length; i++) {
      sharedBillIds = new Set([...sharedBillIds].filter((id) => participantSets[i].has(id)));
    }

    if (sharedBillIds.size === 0) {
      return successResponse({ suggestedMode: null, confidence: 0 });
    }

    // Fetch those bills and count split modes
    const modeCounts: Record<string, number> = {};
    let billsChecked = 0;

    for (const pastBillId of sharedBillIds) {
      const pastBill = await container.getBill.execute(pastBillId).catch(() => null);
      if (!pastBill || pastBill.status === "draft") continue;
      billsChecked++;
      for (const item of pastBill.items) {
        if (item.splitConfig?.mode) {
          modeCounts[item.splitConfig.mode] = (modeCounts[item.splitConfig.mode] ?? 0) + 1;
        }
      }
      if (billsChecked >= 10) break; // cap at 10 past bills
    }

    if (billsChecked < 2) {
      return successResponse({ suggestedMode: null, confidence: 0 });
    }

    // Find the most common mode
    const topMode = Object.entries(modeCounts).sort((a, b) => b[1] - a[1])[0];
    if (!topMode) {
      return successResponse({ suggestedMode: null, confidence: 0 });
    }

    return successResponse({ suggestedMode: topMode[0], confidence: billsChecked });
  } catch (error) {
    return handleApiError(error);
  }
}
