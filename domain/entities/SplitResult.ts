import type { BillId } from "../value-objects/BrandedIds";
import type { Money } from "../value-objects/Money";
import type { Participant } from "./Participant";
import type { BillItem } from "./BillItem";

export type ItemShare = {
  readonly item: BillItem;
  readonly assignedUnitIndices: ReadonlyArray<number>;
  readonly amountOwed: Money;
};

export type ParticipantSplit = {
  readonly participant: Participant;
  readonly itemShares: ReadonlyArray<ItemShare>;
  readonly subtotal: Money;
  readonly taxShare: Money;
  readonly tipShare: Money;
  readonly total: Money;
};

export type UnassignedUnit = {
  readonly item: BillItem;
  readonly unitIndex: number;
};

export type Settlement = {
  readonly from: Participant;
  readonly to: Participant;
  readonly amount: Money;
};

export type SplitResult = {
  readonly billId: BillId;
  readonly participantSplits: ReadonlyArray<ParticipantSplit>;
  readonly unassignedUnits: ReadonlyArray<UnassignedUnit>;
  readonly settlements: ReadonlyArray<Settlement>;
  readonly isComplete: boolean;
  readonly calculatedAt: Date;
};
