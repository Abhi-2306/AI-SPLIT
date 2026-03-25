import type { IBillRepository } from "../../domain/repositories/IBillRepository";
import type { IEventBus } from "../ports/IEventBus";
import { asBillId } from "../../domain/value-objects/BrandedIds";
import { BillNotFoundError } from "../../domain/errors/BillNotFoundError";
import { DomainError } from "../../domain/errors/DomainError";

export type RemoveParticipantInput = {
  billId: string;
  participantId: string;
};

export class RemoveParticipantUseCase {
  constructor(
    private readonly billRepository: IBillRepository,
    private readonly eventBus: IEventBus
  ) {}

  async execute(input: RemoveParticipantInput): Promise<void> {
    const bill = await this.billRepository.findById(asBillId(input.billId));
    if (!bill) throw new BillNotFoundError(input.billId);

    const exists = bill.participants.some((p) => p.id === input.participantId);
    if (!exists) {
      throw new DomainError(
        `Participant "${input.participantId}" not found`,
        "PARTICIPANT_NOT_FOUND"
      );
    }

    // Cascade: remove all assignments for this participant
    const updated = {
      ...bill,
      participants: bill.participants.filter((p) => p.id !== input.participantId),
      assignments: bill.assignments.filter(
        (a) => a.participantId !== input.participantId
      ),
      updatedAt: new Date(),
    };

    await this.billRepository.save(updated);
    await this.eventBus.publish({
      type: "participant.removed",
      billId: bill.id,
      payload: { participantId: input.participantId },
      occurredAt: new Date(),
    });
  }
}
