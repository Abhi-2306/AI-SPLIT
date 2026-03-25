import type { BillId, ParticipantId } from "../value-objects/BrandedIds";
import type { Money } from "../value-objects/Money";
import { addMoney, zeroMoney } from "../value-objects/Money";
import type { BillItem } from "./BillItem";
import type { Participant } from "./Participant";
import type { Assignment } from "./Assignment";

export type BillStatus = "draft" | "assigned" | "settled";

export type Bill = {
  readonly id: BillId;
  readonly title: string;
  readonly currency: string;
  readonly items: ReadonlyArray<BillItem>;
  readonly participants: ReadonlyArray<Participant>;
  readonly assignments: ReadonlyArray<Assignment>;
  readonly subtotal: Money;
  readonly tax: Money | null;
  readonly tip: Money | null;
  readonly total: Money;
  readonly status: BillStatus;
  readonly paidByParticipantId: ParticipantId | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export function computeBillTotals(
  items: ReadonlyArray<BillItem>,
  currency: string,
  tax: Money | null,
  tip: Money | null
): { subtotal: Money; total: Money } {
  const subtotal = items.reduce(
    (acc, item) => addMoney(acc, item.totalPrice),
    zeroMoney(currency)
  );
  const taxAmount = tax?.amount ?? 0;
  const tipAmount = tip?.amount ?? 0;
  const total = { amount: subtotal.amount + taxAmount + tipAmount, currency };
  return { subtotal, total };
}
