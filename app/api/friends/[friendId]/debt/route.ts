import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { successResponse, errorResponse, handleApiError } from "@/lib/utils/apiHelpers";
import { container } from "@/composition-root/container";

type Params = { params: Promise<{ friendId: string }> };

// GET /api/friends/[friendId]/debt
// Returns net balance between current user and a friend across shared bills.
// Positive = friend owes me. Negative = I owe friend.
// Uses splitResult.settlements (domain-calculated optimal settlement graph).
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

    const { friendId } = await params;

    // Find bill IDs where both users are linked participants
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
      return successResponse({ netBalance: 0, currency: null, bills: [] });
    }

    // Per-currency net balances (since bills can have different currencies)
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
      const [bill, splitResult] = await Promise.all([
        container.getBill.execute(billId),
        container.calculateSplit.execute(billId).catch(() => null),
      ]);

      if (!bill || !splitResult || bill.status === "draft") continue;

      // Use the settlement graph calculated by the domain service.
      // Filter settlements involving the current user and the friend.
      let netEffect = 0;
      for (const s of splitResult.settlements) {
        if (s.from.userId === user.id && s.to.userId === friendId) {
          // I owe friend this amount
          netEffect -= s.amount;
        } else if (s.from.userId === friendId && s.to.userId === user.id) {
          // Friend owes me this amount
          netEffect += s.amount;
        }
      }

      netByCurrency[bill.currency] = (netByCurrency[bill.currency] ?? 0) + netEffect;

      const myEntry = splitResult.participantSplits.find((ps) => ps.participant.userId === user.id);
      const friendEntry = splitResult.participantSplits.find((ps) => ps.participant.userId === friendId);

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

    // If all bills share a single currency, return a clean net balance.
    // If mixed currencies, return the breakdown only (netBalance = 0 signals "see details").
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
