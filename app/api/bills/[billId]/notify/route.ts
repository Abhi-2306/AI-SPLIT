import { NextRequest } from "next/server";
import { container } from "@/composition-root/container";
import { successResponse, errorResponse, handleApiError } from "@/lib/utils/apiHelpers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, billSharedEmailHtml } from "@/lib/email";

type Params = { params: Promise<{ billId: string }> };

// POST /api/bills/[billId]/notify — send share emails to participants whose split changed
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

    const { billId } = await params;

    const [fullBill, splitResult] = await Promise.all([
      container.getBill.execute(billId),
      container.calculateSplit.execute(billId).catch(() => null),
    ]);

    if (!fullBill) return errorResponse("NOT_FOUND", "Bill not found", 404);
    if (!splitResult?.isComplete) {
      return errorResponse("INCOMPLETE", "Bill is not fully assigned yet", 400);
    }

    // Load previous snapshot to diff against
    const { data: billRow } = await supabase
      .from("bills")
      .select("notify_snapshot")
      .eq("id", billId)
      .single();

    const prevSnapshot: Record<string, number> = billRow?.notify_snapshot ?? {};

    // Build current totals per participant (only linked, non-zero)
    const currentTotals: Record<string, number> = {};
    for (const ps of splitResult.participantSplits) {
      if (ps.participant.userId && ps.total > 0) {
        currentTotals[ps.participant.userId] = Math.round(ps.total * 100) / 100;
      }
    }

    // Determine who to notify:
    // - No previous snapshot → first notification → notify everyone
    // - Has snapshot → only notify participants whose total changed or who are new
    const isFirstNotify = Object.keys(prevSnapshot).length === 0;
    const toNotify = new Set<string>(
      isFirstNotify
        ? Object.keys(currentTotals)
        : Object.keys(currentTotals).filter(
            (uid) => currentTotals[uid] !== prevSnapshot[uid]
          )
    );

    if (toNotify.size === 0) {
      return successResponse({ notified: 0, message: "No changes since last notification" });
    }

    const { data: creatorProfile } = await supabase.rpc("get_users_display_info", {
      user_ids: [user.id],
    });
    const creatorName =
      (creatorProfile as { display_name: string }[] | null)?.[0]?.display_name ?? "Someone";

    const admin = createAdminClient();
    let notified = 0;

    // Net settlement map: participantId → net amount
    const netMap = new Map<string, number>();
    for (const s of splitResult.settlements) {
      netMap.set(s.from.id, (netMap.get(s.from.id) ?? 0) - s.amount);
      netMap.set(s.to.id, (netMap.get(s.to.id) ?? 0) + s.amount);
    }

    await Promise.all(
      splitResult.participantSplits
        .filter((ps) => ps.participant.userId && toNotify.has(ps.participant.userId))
        .map(async (ps) => {
          try {
            const res = await admin.auth.admin.getUserById(ps.participant.userId!);
            const email = res.data.user?.email;
            if (!email) return;

            const netFromSettlements = netMap.get(ps.participant.id);
            const userShare = Math.round(
              (netFromSettlements !== undefined ? netFromSettlements : -ps.total) * 100
            ) / 100;

            const items = ps.itemShares
              .filter((is) => is.amountOwed > 0)
              .map((is) => ({ name: is.item.name, amountOwed: is.amountOwed }));

            const isCreator = ps.participant.userId === user.id;
            await sendEmail(
              email,
              isCreator
                ? `Your share of "${fullBill.title}"`
                : `${creatorName} shared "${fullBill.title}" with you`,
              billSharedEmailHtml(
                creatorName,
                fullBill.title,
                billId,
                fullBill.currency,
                userShare,
                items,
                ps.subtotal,
                ps.taxShare,
                ps.tipShare,
                ps.total,
              )
            );
            notified++;
          } catch { /* non-fatal per participant */ }
        })
    );

    // Save current totals as new snapshot
    await supabase
      .from("bills")
      .update({ notify_snapshot: currentTotals })
      .eq("id", billId);

    return successResponse({ notified });
  } catch (error) {
    return handleApiError(error);
  }
}
