/**
 * Composition Root — the ONLY place that imports from both infrastructure/ and application/.
 * All concrete implementations are wired here.
 * Changing implementations for future iterations = changing one line in this file.
 */

import { InMemoryBillRepository } from "../infrastructure/repositories/InMemoryBillRepository";
import { GroqReceiptService } from "../infrastructure/ocr/GroqReceiptService";
import { NoOpEventBus } from "../infrastructure/events/NoOpEventBus";

import { CreateBillUseCase } from "../application/use-cases/CreateBillUseCase";
import { GetBillUseCase } from "../application/use-cases/GetBillUseCase";
import { UpdateBillMetaUseCase } from "../application/use-cases/UpdateBillMetaUseCase";
import { AddParticipantUseCase } from "../application/use-cases/AddParticipantUseCase";
import { RemoveParticipantUseCase } from "../application/use-cases/RemoveParticipantUseCase";
import { AddBillItemUseCase } from "../application/use-cases/AddBillItemUseCase";
import { UpdateBillItemUseCase } from "../application/use-cases/UpdateBillItemUseCase";
import { DeleteBillItemUseCase } from "../application/use-cases/DeleteBillItemUseCase";
import { AssignItemToParticipantUseCase } from "../application/use-cases/AssignItemToParticipantUseCase";
import { UnassignItemFromParticipantUseCase } from "../application/use-cases/UnassignItemFromParticipantUseCase";
import { CalculateSplitUseCase } from "../application/use-cases/CalculateSplitUseCase";
import { ProcessReceiptOcrUseCase } from "../application/use-cases/ProcessReceiptOcrUseCase";

// Infrastructure instances
const billRepository = new InMemoryBillRepository();
const eventBus = new NoOpEventBus();
const receiptExtractor = new GroqReceiptService();   // ← swap here for future providers

// Use case instances — each receives its dependencies via constructor injection
export const container = {
  createBill: new CreateBillUseCase(billRepository, eventBus),
  getBill: new GetBillUseCase(billRepository),
  updateBillMeta: new UpdateBillMetaUseCase(billRepository),
  addParticipant: new AddParticipantUseCase(billRepository, eventBus),
  removeParticipant: new RemoveParticipantUseCase(billRepository, eventBus),
  addBillItem: new AddBillItemUseCase(billRepository, eventBus),
  updateBillItem: new UpdateBillItemUseCase(billRepository, eventBus),
  deleteBillItem: new DeleteBillItemUseCase(billRepository, eventBus),
  assignItem: new AssignItemToParticipantUseCase(billRepository, eventBus),
  unassignItem: new UnassignItemFromParticipantUseCase(billRepository, eventBus),
  calculateSplit: new CalculateSplitUseCase(billRepository),
  processReceiptOcr: new ProcessReceiptOcrUseCase(receiptExtractor),
} as const;
