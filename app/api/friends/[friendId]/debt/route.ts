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

    // Fetch participant entries (with their participant ID) for each user
    const [{ data: myRows, error: myErr }, { data: friendRows, error: friendErr }] =
      await Promise.all([
        supabase.from("participants").select("id, bill_id").eq("user_id", user.id),
        supabase.from("participants").select("id, bill_id").eq("user_id", friendId),
      ]);

    if (myErr) throw myErr;
    if (friendErr) throw friendErr;

    // Build maps: bill_id → participant_id for fast lookup
    const myParticipantByBill = new Map((myRows ?? []).map((r) => [r.bill_id, r.id]));
    const friendParticipantByBill = new Map((friendRows ?? []).map((r) => [r.bill_id, r.id]));

    // Bills where both users are linked participants
    const sharedBillIds = [...myParticipantByBill.keys()].filter((id) =>
      friendParticipantByBill.has(id)
    );

    if (sharedBillIds.length === 0) {
      return successResponse({ netBalance: 0, currency: null, bills: [] });
    }

    const netByCurrency: Record<string, number> = {};
    const billBreakdowns: Array<{
      billId: string;
      billTitle: string;
      myAmount: number;
      friendAmount: number;
      netEffect: number;
      currency: string;
    }> = [];

    for (const billId of sharedBillIds) {
      const myParticipantId = myParticipantByBill.get(billId)!;
      const friendParticipantId = friendParticipantByBill.get(billId)!;

      const [bill, splitResult] = await Promise.all([
        container.getBill.execute(billId),
        container.calculateSplit.execute(billId).catch(() => null),
      ]);

      if (!bill || !splitResult || bill.status === "draft") continue;

      // Match settlements using participant IDs (always set, unlike userId which may be null)
      let netEffect = 0;
      for (const s of splitResult.settlements) {
        if (s.from.id === myParticipantId && s.to.id === friendParticipantId) {
          // I owe friend
          netEffect -= s.amount;
        } else if (s.from.id === friendParticipantId && s.to.id === myParticipantId) {
          // Friend owes me
          netEffect += s.amount;
        }
      }

      netByCurrency[bill.currency] = (netByCurrency[bill.currency] ?? 0) + netEffect;

      const myEntry = splitResult.participantSplits.find(
        (ps) => ps.participant.id === myParticipantId
      );
      const friendEntry = splitResult.participantSplits.find(
        (ps) => ps.participant.id === friendParticipantId
      );

      if (!myEntry || !friendEntry) continue;

      billBreakdowns.push({
        billId,
        billTitle: bill.title,
        myAmount: myEntry.total,
        friendAmount: friendEntry.total,
        netEffect: Math.round(netEffect * 100) / 100,
        currency: bill.currency,
      });
    }

    const currencies = Object.keys(netByCurrency);
    const netBalance =
      currencies.length === 1
        ? Math.round(netByCurrency[currencies[0]] * 100) / 100
        : 0;
    const currency = currencies.length === 1 ? currencies[0] : null;

    return successResponse({ netBalance, currency, bills: billBreakdowns });
  } catch (error) {
    return handleApiError(error);
  }
}
