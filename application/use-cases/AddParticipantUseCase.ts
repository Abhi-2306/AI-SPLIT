import type { IBillRepository } from "../../domain/repositories/IBillRepository";
import type { IEventBus } from "../ports/IEventBus";
import { asBillId, asParticipantId } from "../../domain/value-objects/BrandedIds";
import { BillNotFoundError } from "../../domain/errors/BillNotFoundError";
import { DomainError } from "../../domain/errors/DomainError";
import { generateId } from "../../lib/utils/idGenerator";
import type { ParticipantDto } from "../dtos/index";
import { mapParticipant } from "../dtos/mappers";

export type AddParticipantInput = {
  billId: string;
  name: string;
  userId?: string | null;
};

export class AddParticipantUseCase {
  constructor(
    private readonly billRepository: IBillRepository,
    private readonly eventBus: IEventBus
  ) {}

  async execute(input: AddParticipantInput): Promise<ParticipantDto> {
    const bill = await this.billRepository.findById(asBillId(input.billId));
    if (!bill) throw new BillNotFoundError(input.billId);

    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new DomainError("Participant name cannot be empty", "INVALID_PARTICIPANT_NAME");
    }

    const nameExists = bill.participants.some(
      (p) => p.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (nameExists) {
      throw new DomainError(
        `Participant "${trimmedName}" already exists in this bill`,
        "DUPLICATE_PARTICIPANT"
      );
    }

    const participant = {
      id: asParticipantId(generateId()),
      name: trimmedName,
      userId: input.userId ?? null,
      createdAt: new Date(),
    };

    const updated = {
      ...bill,
      participants: [...bill.participants, participant],
      updatedAt: new Date(),
    };

    await this.billRepository.save(updated);
    await this.eventBus.publish({
      type: "participant.added",
      billId: bill.id,
      payload: { participantId: participant.id, name: participant.name },
      occurredAt: new Date(),
    });

    return mapParticipant(participant);
  }
}
