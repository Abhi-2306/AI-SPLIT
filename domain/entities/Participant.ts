import type { ParticipantId } from "../value-objects/BrandedIds";

export type Participant = {
  readonly id: ParticipantId;
  readonly name: string;
  readonly createdAt: Date;
};
