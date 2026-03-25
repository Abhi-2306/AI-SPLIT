import type { Bill } from "../../domain/entities/Bill";
import type { BillItem } from "../../domain/entities/BillItem";
import type { Participant } from "../../domain/entities/Participant";
import type { Assignment } from "../../domain/entities/Assignment";
import type { SplitResult, Settlement } from "../../domain/entities/SplitResult";
import type {
  BillDto,
  BillItemDto,
  ParticipantDto,
  AssignmentDto,
  SplitResultDto,
  SettlementDto,
} from "./index";

export function mapParticipant(p: Participant): ParticipantDto {
  return { id: p.id, name: p.name, createdAt: p.createdAt.toISOString() };
}

export function mapBillItem(item: BillItem): BillItemDto {
  return {
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    unitPrice: item.unitPrice.amount,
    totalPrice: item.totalPrice.amount,
    notes: item.notes,
    splitConfig: item.splitConfig
      ? { mode: item.splitConfig.mode, entries: item.splitConfig.entries.map((e) => ({ participantId: e.participantId, value: e.value })) }
      : null,
  };
}

export function mapAssignment(a: Assignment): AssignmentDto {
  return {
    id: a.id,
    billItemId: a.billItemId,
    participantId: a.participantId,
    unitIndex: a.unitIndex,
  };
}

export function mapBill(bill: Bill): BillDto {
  return {
    id: bill.id,
    title: bill.title,
    currency: bill.currency,
    items: bill.items.map(mapBillItem),
    participants: bill.participants.map(mapParticipant),
    assignments: bill.assignments.map(mapAssignment),
    subtotal: bill.subtotal.amount,
    tax: bill.tax?.amount ?? null,
    tip: bill.tip?.amount ?? null,
    total: bill.total.amount,
    status: bill.status,
    paidByParticipantId: bill.paidByParticipantId ?? null,
    createdAt: bill.createdAt.toISOString(),
    updatedAt: bill.updatedAt.toISOString(),
  };
}

export function mapSplitResult(result: SplitResult): SplitResultDto {
  return {
    billId: result.billId,
    participantSplits: result.participantSplits.map((ps) => ({
      participant: mapParticipant(ps.participant),
      itemShares: ps.itemShares.map((is) => ({
        item: mapBillItem(is.item),
        assignedUnitIndices: [...is.assignedUnitIndices],
        amountOwed: is.amountOwed.amount,
      })),
      subtotal: ps.subtotal.amount,
      taxShare: ps.taxShare.amount,
      tipShare: ps.tipShare.amount,
      total: ps.total.amount,
    })),
    unassignedUnits: result.unassignedUnits.map((u) => ({
      item: mapBillItem(u.item),
      unitIndex: u.unitIndex,
    })),
    settlements: result.settlements.map((s: Settlement): SettlementDto => ({
      from: mapParticipant(s.from),
      to: mapParticipant(s.to),
      amount: s.amount.amount,
    })),
    isComplete: result.isComplete,
    calculatedAt: result.calculatedAt.toISOString(),
  };
}
