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

    // Three parallel queries:
    // 1. Bills where current user is a linked participant (userId set on participant row)
    // 2. Bills current user CREATED with paidBy set — fallback for when creator's participant has userId=NULL
    // 3. Bills FRIEND CREATED with paidBy set — fallback for when friend's participant has userId=NULL
    const [
      { data: myParticipantRows, error: myErr },
      { data: myCreatedBills, error: myCreatedErr },
      { data: friendCreatedBills, error: friendCreatedErr },
    ] = await Promise.all([
      supabase.from("participants").select("id, bill_id").eq("user_id", user.id),
      supabase
        .from("bills")
        .select("id, paid_by_participant_id")
        .eq("user_id", user.id)
        .not("paid_by_participant_id", "is", null),
      supabase
        .from("bills")
        .select("id, paid_by_participant_id")
        .eq("user_id", friendId)
        .not("paid_by_participant_id", "is", null),
    ]);

    if (myErr) throw myErr;
    if (myCreatedErr) throw myCreatedErr;
    if (friendCreatedErr) throw friendCreatedErr;

    // Build my participant map: bill_id → my participant_id
    const myParticipantByBill = new Map((myParticipantRows ?? []).map((r) => [r.bill_id, r.id]));

    // Fallback: for bills I created where my participant has userId=NULL,
    // assume paidByParticipantId is mine (creator typically sets themselves as payer)
    for (const b of myCreatedBills ?? []) {
      if (!myParticipantByBill.has(b.id) && b.paid_by_participant_id) {
        myParticipantByBill.set(b.id, b.paid_by_participant_id);
      }
    }

    if (myParticipantByBill.size === 0) {
      return successResponse({ netBalance: 0, currency: null, bills: [] });
    }

    // Fallback map for finding friend's participant when their userId=NULL on the row
    const friendParticipantFromCreation = new Map(
      (friendCreatedBills ?? [])
        .filter((b) => b.paid_by_participant_id)
        .map((b) => [b.id, b.paid_by_participant_id as string])
    );

    const netByCurrency: Record<string, number> = {};
    const billBreakdowns: Array<{
      billId: string;
      billTitle: string;
      myAmount: number;
      friendAmount: number;
      netEffect: number;
      currency: string;
    }> = [];

    for (const [billId, myParticipantId] of myParticipantByBill.entries()) {
      const [bill, splitResult] = await Promise.all([
        container.getBill.execute(billId),
        container.calculateSplit.execute(billId).catch(() => null),
      ]);

      if (!bill || !splitResult || bill.status === "draft") continue;

      // Find friend's participant: by userId in bill.participants first,
      // then fall back to paidByParticipantId on bills the friend created
      const friendParticipantByUserId = bill.participants.find((p) => p.userId === friendId);
      const friendParticipantId =
        friendParticipantByUserId?.id ?? friendParticipantFromCreation.get(billId) ?? null;

      if (!friendParticipantId) continue; // friend not in this bill

      // Match settlements using participant IDs (SettlementDto.amount is a plain number)
      let netEffect = 0;
      for (const s of splitResult.settlements) {
        if (s.from.id === myParticipantId && s.to.id === friendParticipantId) {
          netEffect -= s.amount; // I owe friend
        } else if (s.from.id === friendParticipantId && s.to.id === myParticipantId) {
          netEffect += s.amount; // Friend owes me
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
