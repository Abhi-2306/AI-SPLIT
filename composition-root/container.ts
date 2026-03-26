/**
 * Composition Root — the ONLY place that imports from both infrastructure/ and application/.
 * All concrete implementations are wired here.
 * Changing implementations for future iterations = changing one line in this file.
 */

import { SupabaseBillRepository } from "../infrastructure/repositories/SupabaseBillRepository";
import { GroqReceiptService } from "../infrastructure/ocr/GroqReceiptService";
import { NoOpEventBus } from "../infrastructure/events/NoOpEventBus";

import { CreateBillUseCase } from "../application/use-cases/CreateBillUseCase";
import { GetBillUseCase } from "../application/use-cases/GetBillUseCase";
import { UpdateBillMetaUseCase } from "../application/use-cases/UpdateBillMetaUseCase";
import { AddParticipantUseCase } from "../application/use-cases/AddParticipantUseCase";
import { RemoveParticipantUseCase } from "../application/use-cases/RemoveParticipantUseCase";
import { UpdateParticipantUseCase } from "../application/use-cases/UpdateParticipantUseCase";
import { AddBillItemUseCase } from "../application/use-cases/AddBillItemUseCase";
import { BatchAddBillItemsUseCase } from "../application/use-cases/BatchAddBillItemsUseCase";
import { UpdateBillItemUseCase } from "../application/use-cases/UpdateBillItemUseCase";
import { DeleteBillItemUseCase } from "../application/use-cases/DeleteBillItemUseCase";
import { AssignItemToParticipantUseCase } from "../application/use-cases/AssignItemToParticipantUseCase";
import { UnassignItemFromParticipantUseCase } from "../application/use-cases/UnassignItemFromParticipantUseCase";
import { CalculateSplitUseCase } from "../application/use-cases/CalculateSplitUseCase";
import { ProcessReceiptOcrUseCase } from "../application/use-cases/ProcessReceiptOcrUseCase";

// Infrastructure instances — SupabaseBillRepository reads cookies() per-request inside each method
const billRepository = new SupabaseBillRepository();
const eventBus = new NoOpEventBus();
const receiptExtractor = new GroqReceiptService();

// Use case instances — each receives its dependencies via constructor injection
export const container = {
  createBill: new CreateBillUseCase(billRepository, eventBus),
  getBill: new GetBillUseCase(billRepository),
  updateBillMeta: new UpdateBillMetaUseCase(billRepository),
  addParticipant: new AddParticipantUseCase(billRepository, eventBus),
  removeParticipant: new RemoveParticipantUseCase(billRepository, eventBus),
  updateParticipant: new UpdateParticipantUseCase(billRepository),
  addBillItem: new AddBillItemUseCase(billRepository, eventBus),
  batchAddItems: new BatchAddBillItemsUseCase(billRepository, eventBus),
  updateBillItem: new UpdateBillItemUseCase(billRepository, eventBus),
  deleteBillItem: new DeleteBillItemUseCase(billRepository, eventBus),
  assignItem: new AssignItemToParticipantUseCase(billRepository, eventBus),
  unassignItem: new UnassignItemFromParticipantUseCase(billRepository, eventBus),
  calculateSplit: new CalculateSplitUseCase(billRepository),
  processReceiptOcr: new ProcessReceiptOcrUseCase(receiptExtractor),
} as const;
