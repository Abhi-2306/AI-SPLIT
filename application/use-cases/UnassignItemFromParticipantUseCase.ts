import type { IBillRepository } from "../../domain/repositories/IBillRepository";
import type { IEventBus } from "../ports/IEventBus";
import { asBillId } from "../../domain/value-objects/BrandedIds";
import { BillNotFoundError } from "../../domain/errors/BillNotFoundError";
import { InvalidAssignmentError } from "../../domain/errors/InvalidAssignmentError";

export type UnassignItemInput = {
  billId: string;
  itemId: string;
  participantId: string;
  unitIndex: number;
};

export class UnassignItemFromParticipantUseCase {
  constructor(
    private readonly billRepository: IBillRepository,
    private readonly eventBus: IEventBus
  ) {}

  async execute(input: UnassignItemInput): Promise<void> {
    const bill = await this.billRepository.findById(asBillId(input.billId));
    if (!bill) throw new BillNotFoundError(input.billId);

    const assignmentIndex = bill.assignments.findIndex(
      (a) =>
        a.billItemId === input.itemId &&
        a.participantId === input.participantId &&
        a.unitIndex === input.unitIndex
    );

    if (assignmentIndex === -1) {
      throw new InvalidAssignmentError(
        `no assignment found for item "${input.itemId}", participant "${input.participantId}", unit ${input.unitIndex}`
      );
    }

    const removedAssignment = bill.assignments[assignmentIndex];

    const updated = {
      ...bill,
      assignments: bill.assignments.filter((_, i) => i !== assignmentIndex),
      updatedAt: new Date(),
    };

    await this.billRepository.save(updated);
    await this.eventBus.publish({
      type: "assignment.removed",
      billId: bill.id,
      payload: { assignmentId: removedAssignment.id },
      occurredAt: new Date(),
    });
  }
}
