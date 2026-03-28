import { container } from "@/composition-root/container";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendEmail, billUpdatedEmailHtml } from "@/lib/email";
import type { SplitResultDto } from "@/application/dtos";

export async function notifyAffectedParticipants(
  billId: string,
  oldSplit: SplitResultDto | null,
): Promise<void> {
  // oldSplit === null means the old bill was not fully explicit — nothing to diff against
  if (!oldSplit) return;

  const [newSplit, bill] = await Promise.all([
    container.calculateSplit.execute(billId).catch(() => null),
    container.getBill.execute(billId),
  ]);

  // Only notify if every item has an explicit splitConfig or per-unit assignment —
  // items defaulting to "equally" without user action don't count
  const allItemsExplicit =
    (bill?.items.length ?? 0) > 0 &&
    bill!.items.every(
      (i) =>
        i.splitConfig !== null ||
        bill!.assignments.some((a) => a.billItemId === i.id)
    );
  if (!newSplit?.isComplete || !bill || !allItemsExplicit) return;

  // Build old totals map: participantId -> total
  const oldTotals = new Map<string, number>();
  for (const ps of oldSplit?.participantSplits ?? []) {
    oldTotals.set(ps.participant.id, ps.total);
  }

  // Find participants whose share changed by more than $0.01
  const affected = newSplit.participantSplits.filter((ps) => {
    if (!ps.participant.userId) return false;
    const oldTotal = oldTotals.get(ps.participant.id) ?? 0;
    return Math.abs(ps.total - oldTotal) > 0.01;
  });

  if (affected.length === 0) return;

  // Net settlement per participant (positive = owed to them, negative = they owe)
  const netMap = new Map<string, number>();
  for (const s of newSplit.settlements) {
    netMap.set(s.from.id, (netMap.get(s.from.id) ?? 0) - s.amount);
    netMap.set(s.to.id, (netMap.get(s.to.id) ?? 0) + s.amount);
  }

  // Get bill creator's display name
  const supabase = await createClient();
  const { data: billRow } = await supabase
    .from("bills").select("user_id").eq("id", billId).single();
  const { data: creatorProfile } = await supabase.rpc("get_users_display_info", {
    user_ids: billRow?.user_id ? [billRow.user_id] : [],
  });
  const updaterName =
    (creatorProfile as { display_name: string }[] | null)?.[0]?.display_name ?? "Someone";

  const admin = createAdminClient();

  await Promise.all(
    affected.map(async (ps) => {
      try {
        const res = await admin.auth.admin.getUserById(ps.participant.userId!);
        const email = res.data.user?.email;
        if (!email) return;

        const netFromSettlements = netMap.get(ps.participant.id);
        const userShare = Math.round(
          (netFromSettlements !== undefined ? netFromSettlements : -ps.total) * 100
        ) / 100;
        const oldTotal = oldTotals.get(ps.participant.id) ?? 0;
        const items = ps.itemShares
          .filter((is) => is.amountOwed > 0)
          .map((is) => ({ name: is.item.name, amountOwed: is.amountOwed }));

        await sendEmail(
          email,
          `Your share in "${bill!.title}" was updated`,
          billUpdatedEmailHtml(
            updaterName,
            bill!.title,
            billId,
            bill!.currency,
            userShare,
            oldTotal,
            ps.total,
            items,
            ps.subtotal,
            ps.taxShare,
            ps.tipShare,
            ps.total,
          )
        );
      } catch { /* Non-fatal per participant */ }
    })
  );
}
