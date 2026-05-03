import type { Bill } from "../entities/Bill";
import type { SplitResult, ParticipantSplit, ItemShare, UnassignedUnit, Settlement } from "../entities/SplitResult";
import type { Money } from "../value-objects/Money";
import { createMoney, zeroMoney, addMoney } from "../value-objects/Money";

/**
 * Pure domain service. Computes the split result from a bill's current state.
 * No side effects, no external dependencies.
 *
 * Per-item split logic:
 *  - If item.splitConfig is set → use the config mode for calculation
 *  - If item.splitConfig is null → use unit-based assignment logic (legacy / Per Unit mode)
 */
export function calculateSplit(bill: Bill): SplitResult {
  const unassignedUnits: UnassignedUnit[] = [];

  // Identify truly unassigned units.
  // Items the user never touched default to "equally among all" — not unassigned.
  for (const item of bill.items) {
    if (item.splitConfig !== null) {
      // splitConfig present but empty entries → user cleared it, not a default → unassigned
      if (item.splitConfig.entries.length === 0) {
        unassignedUnits.push({ item, unitIndex: 0 });
      }
      continue;
    }
    // splitConfig === null: only flag as unassigned if SOME units are assigned but not all.
    // If ZERO assignments exist for the item, the user never touched it → default equally, not unassigned.
    const itemHasAnyAssignment = bill.assignments.some((a) => a.billItemId === item.id);
    if (!itemHasAnyAssignment) continue; // will be treated as equally split below
    for (let unitIndex = 0; unitIndex < item.quantity; unitIndex++) {
      const isAssigned = bill.assignments.some(
        (a) => a.billItemId === item.id && a.unitIndex === unitIndex
      );
      if (!isAssigned) {
        unassignedUnits.push({ item, unitIndex });
      }
    }
  }

  const participantSplits: ParticipantSplit[] = bill.participants.map((participant) => {
    const itemShares: ItemShare[] = [];
    let subtotalAmount = 0;

    for (const item of bill.items) {
      let amountOwed: Money;
      let assignedUnitIndices: number[] = [];

      if (item.splitConfig !== null && item.splitConfig.entries.length > 0) {
        // ── Config-based split ──────────────────────────────────────────────
        const entry = item.splitConfig.entries.find(
          (e) => e.participantId === participant.id
        );
        if (!entry) continue;

        const totalPrice = item.totalPrice.amount;
        const { mode, entries } = item.splitConfig;

        let share = 0;
        if (mode === "equally") {
          share = totalPrice / entries.length;
        } else if (mode === "by_count") {
          const totalCount = entries.reduce((s, e) => s + e.value, 0);
          share = totalCount === 0 ? 0 : (entry.value / totalCount) * totalPrice;
        } else if (mode === "by_percentage") {
          share = (entry.value / 100) * totalPrice;
        } else if (mode === "by_shares") {
          const totalShares = entries.reduce((s, e) => s + e.value, 0);
          share = totalShares === 0 ? 0 : (entry.value / totalShares) * totalPrice;
        } else if (mode === "by_amount") {
          share = entry.value;
        }

        amountOwed = createMoney(share, bill.currency);
        assignedUnitIndices = [0]; // placeholder for display
      } else if (item.splitConfig === null) {
        // ── Unit-based split (legacy / Per Unit mode) ───────────────────────
        const itemHasAnyAssignment = bill.assignments.some((a) => a.billItemId === item.id);

        if (!itemHasAnyAssignment) {
          // User never touched this item → default: split equally among all participants
          if (bill.participants.length === 0) continue;
          amountOwed = createMoney(item.totalPrice.amount / bill.participants.length, bill.currency);
          assignedUnitIndices = Array.from({ length: item.quantity }, (_, i) => i);
        } else {
          let amountOwedTotal = 0;

          for (let u = 0; u < item.quantity; u++) {
            const sharersOfUnit = bill.assignments.filter(
              (a) => a.billItemId === item.id && a.unitIndex === u
            );
            const isSharer = sharersOfUnit.some((a) => a.participantId === participant.id);
            if (!isSharer) continue;

            amountOwedTotal += item.unitPrice.amount / sharersOfUnit.length;
            assignedUnitIndices.push(u);
          }

          if (assignedUnitIndices.length === 0) continue;
          amountOwed = createMoney(amountOwedTotal, bill.currency);
        }
      } else {
        continue;
      }

      subtotalAmount += amountOwed.amount;
      itemShares.push({ item, assignedUnitIndices, amountOwed });
    }

    const subtotal = createMoney(subtotalAmount, bill.currency);
    const billSubtotalAmount = bill.subtotal.amount;
    const proportion = billSubtotalAmount === 0 ? 0 : subtotalAmount / billSubtotalAmount;

    const taxShare: Money =
      bill.tax !== null
        ? createMoney(bill.tax.amount * proportion, bill.currency)
        : zeroMoney(bill.currency);

    const discountShare: Money =
      bill.discount !== null
        ? createMoney(bill.discount.amount * proportion, bill.currency)
        : zeroMoney(bill.currency);

    const tipShare: Money =
      bill.tip !== null
        ? createMoney(bill.tip.amount * proportion, bill.currency)
        : zeroMoney(bill.currency);

    const total = createMoney(
      subtotalAmount + taxShare.amount - discountShare.amount + tipShare.amount,
      bill.currency
    );

    return { participant, itemShares, subtotal, taxShare, discountShare, tipShare, total };
  });

  // ── Settlements (who owes the payer) ───────────────────────────────────────
  const settlements: Settlement[] = [];
  if (bill.paidByParticipantId) {
    const payer = bill.participants.find((p) => p.id === bill.paidByParticipantId);
    if (payer) {
      for (const ps of participantSplits) {
        if (ps.participant.id === payer.id) continue;
        if (ps.total.amount <= 0) continue;
        settlements.push({
          from: ps.participant,
          to: payer,
          amount: ps.total,
        });
      }
    }
  }

  return {
    billId: bill.id,
    participantSplits,
    unassignedUnits,
    settlements,
    isComplete: unassignedUnits.length === 0,
    calculatedAt: new Date(),
  };
}
