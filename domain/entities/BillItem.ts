import type { BillItemId, ParticipantId } from "../value-objects/BrandedIds";
import type { Money } from "../value-objects/Money";
import { multiplyMoney } from "../value-objects/Money";

export type SplitMode = "equally" | "by_count" | "by_percentage" | "by_shares" | "by_amount";

export type SplitEntry = {
  readonly participantId: ParticipantId;
  readonly value: number; // meaning depends on mode: count | percentage | shares | exact amount
};

export type ItemSplitConfig = {
  readonly mode: SplitMode;
  readonly entries: ReadonlyArray<SplitEntry>;
};

export type BillItem = {
  readonly id: BillItemId;
  readonly name: string;
  readonly quantity: number;
  readonly unitPrice: Money;
  readonly totalPrice: Money;
  readonly notes: string | null;
  readonly splitConfig: ItemSplitConfig | null;
};

export function createBillItem(
  id: BillItemId,
  name: string,
  quantity: number,
  unitPrice: Money,
  notes: string | null = null,
  splitConfig: ItemSplitConfig | null = null
): BillItem {
  return {
    id,
    name,
    quantity,
    unitPrice,
    totalPrice: multiplyMoney(unitPrice, quantity),
    notes,
    splitConfig,
  };
}
