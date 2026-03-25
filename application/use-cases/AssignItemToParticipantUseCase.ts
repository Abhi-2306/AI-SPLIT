import type { IBillRepository } from "../../domain/repositories/IBillRepository";
import type { IEventBus } from "../ports/IEventBus";
import { asBillId, asAssignmentId } from "../../domain/value-objects/BrandedIds";
import { BillNotFoundError } from "../../domain/errors/BillNotFoundError";
import { InvalidAssignmentError } from "../../domain/errors/InvalidAssignmentError";
import { generateId } from "../../lib/utils/idGenerator";
import type { AssignmentDto } from "../dtos/index";
import { mapAssignment } from "../dtos/mappers";

export type AssignItemInput = {
  billId: string;
  itemId: string;
  participantId: string;
  unitIndex: number;
};

export class AssignItemToParticipantUseCase {
  constructor(
    private readonly billRepository: IBillRepository,
    private readonly eventBus: IEventBus
  ) {}

  async execute(input: AssignItemInput): Promise<AssignmentDto> {
    const bill = await this.billRepository.findById(asBillId(input.billId));
    if (!bill) throw new BillNotFoundError(input.billId);

    const item = bill.items.find((i) => i.id === input.itemId);
    if (!item) {
      throw new InvalidAssignmentError(`item "${input.itemId}" does not exist`);
    }

    const participant = bill.participants.find((p) => p.id === input.participantId);
    if (!participant) {
      throw new InvalidAssignmentError(`participant "${input.participantId}" does not exist`);
    }

    if (input.unitIndex < 0 || input.unitIndex >= item.quantity) {
      throw new InvalidAssignmentError(
        `unitIndex ${input.unitIndex} is out of range for item with quantity ${item.quantity}`
      );
    }

    // Block the same participant being assigned to the same unit twice
    const alreadyAssignedToSamePerson = bill.assignments.some(
      (a) =>
        a.billItemId === input.itemId &&
        a.unitIndex === input.unitIndex &&
        a.participantId === input.participantId
    );
    if (alreadyAssignedToSamePerson) {
      throw new InvalidAssignmentError(
        `participant "${input.participantId}" is already assigned to unit ${input.unitIndex} of item "${item.name}"`
      );
    }

    const assignment = {
      id: asAssignmentId(generateId()),
      billItemId: item.id,
      participantId: participant.id,
      unitIndex: input.unitIndex,
    };

    const updated = {
      ...bill,
      assignments: [...bill.assignments, assignment],
      updatedAt: new Date(),
    };

    await this.billRepository.save(updated);
    await this.eventBus.publish({
      type: "assignment.added",
      billId: bill.id,
      payload: { assignmentId: assignment.id },
      occurredAt: new Date(),
    });

    return mapAssignment(assignment);
  }
}
