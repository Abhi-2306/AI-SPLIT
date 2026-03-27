import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { successResponse, errorResponse, handleApiError } from "@/lib/utils/apiHelpers";
import { container } from "@/composition-root/container";

type Params = { params: Promise<{ friendId: string }> };

// GET /api/friends/[friendId]/debt
// Returns net balance between current user and a friend across shared bills.
// Positive = friend owes me. Negative = I owe friend.
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

    const { friendId } = await params;

    // Find bill IDs where the current user is a linked participant
    const [{ data: myRows, error: myErr }, { data: friendRows, error: friendErr }] =
      await Promise.all([
        supabase.from("participants").select("bill_id").eq("user_id", user.id),
        supabase.from("participants").select("bill_id").eq("user_id", friendId),
      ]);

    if (myErr) throw myErr;
    if (friendErr) throw friendErr;

    const myBillIds = new Set((myRows ?? []).map((r) => r.bill_id));
    const sharedBillIds = (friendRows ?? [])
      .map((r) => r.bill_id)
      .filter((id) => myBillIds.has(id));

    if (sharedBillIds.length === 0) {
      return successResponse({ netBalance: 0, bills: [] });
    }

    let netBalance = 0;
    const billBreakdowns: Array<{
      billId: string;
      billTitle: string;
      myAmount: number;
      friendAmount: number;
      netEffect: number;
      currency: string;
    }> = [];

    for (const billId of sharedBillIds) {
      const [bill, splitResult] = await Promise.all([
        container.getBill.execute(billId),
        container.calculateSplit.execute(billId).catch(() => null),
      ]);

      if (!bill || !splitResult || bill.status === "draft") continue;

      const myEntry = splitResult.participantSplits.find(
        (ps) => ps.participant.userId === user.id
      );
      const friendEntry = splitResult.participantSplits.find(
        (ps) => ps.participant.userId === friendId
      );

      if (!myEntry || !friendEntry) continue;

      let netEffect = 0;

      if (bill.paidByParticipantId) {
        const payer = bill.participants.find((p) => p.id === bill.paidByParticipantId);
        if (payer?.userId === user.id) {
          // I paid — friend owes me their share
          netEffect = friendEntry.total;
        } else if (payer?.userId === friendId) {
          // Friend paid — I owe friend my share
          netEffect = -myEntry.total;
        }
      }

      netBalance += netEffect;

      billBreakdowns.push({
        billId,
        billTitle: bill.title,
        myAmount: myEntry.total,
        friendAmount: friendEntry.total,
        netEffect: Math.round(netEffect * 100) / 100,
        currency: bill.currency,
      });
    }

    return successResponse({
      netBalance: Math.round(netBalance * 100) / 100,
      bills: billBreakdowns,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
