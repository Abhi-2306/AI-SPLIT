import type { IBillRepository } from "../../domain/repositories/IBillRepository";
import { asBillId, asParticipantId } from "../../domain/value-objects/BrandedIds";
import { BillNotFoundError } from "../../domain/errors/BillNotFoundError";
import { DomainError } from "../../domain/errors/DomainError";
import type { ParticipantDto } from "../dtos/index";
import { mapParticipant } from "../dtos/mappers";

export type UpdateParticipantInput = {
  billId: string;
  participantId: string;
  name: string;
};

export class UpdateParticipantUseCase {
  constructor(private readonly billRepository: IBillRepository) {}

  async execute(input: UpdateParticipantInput): Promise<ParticipantDto> {
    const bill = await this.billRepository.findById(asBillId(input.billId));
    if (!bill) throw new BillNotFoundError(input.billId);

    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new DomainError("Participant name cannot be empty", "INVALID_PARTICIPANT_NAME");
    }

    const participant = bill.participants.find(
      (p) => p.id === asParticipantId(input.participantId)
    );
    if (!participant) {
      throw new DomainError(
        `Participant "${input.participantId}" not found`,
        "PARTICIPANT_NOT_FOUND"
      );
    }

    const updated = {
      ...bill,
      participants: bill.participants.map((p) =>
        p.id === participant.id ? { ...p, name: trimmedName } : p
      ),
      updatedAt: new Date(),
    };

    await this.billRepository.save(updated);
    return mapParticipant({ ...participant, name: trimmedName });
  }
}
