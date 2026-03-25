import type { AssignmentId, BillItemId, ParticipantId } from "../value-objects/BrandedIds";

/**
 * An Assignment represents that a specific participant is responsible for
 * one unit (by unitIndex) of a specific BillItem.
 *
 * Example: Pizza has quantity=3.
 *   Assignment { itemId: pizza, participantId: john, unitIndex: 0 } = Pizza #1 → John
 *   Assignment { itemId: pizza, participantId: alice, unitIndex: 1 } = Pizza #2 → Alice
 */
export type Assignment = {
  readonly id: AssignmentId;
  readonly billItemId: BillItemId;
  readonly participantId: ParticipantId;
  readonly unitIndex: number;
};
