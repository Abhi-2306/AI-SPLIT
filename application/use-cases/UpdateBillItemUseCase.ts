import type { IBillRepository } from "../../domain/repositories/IBillRepository";
import type { IEventBus } from "../ports/IEventBus";
import { asBillId, asParticipantId } from "../../domain/value-objects/BrandedIds";
import { createMoney } from "../../domain/value-objects/Money";
import { createBillItem } from "../../domain/entities/BillItem";
import type { ItemSplitConfig } from "../../domain/entities/BillItem";
import { computeBillTotals } from "../../domain/entities/Bill";
import { BillNotFoundError } from "../../domain/errors/BillNotFoundError";
import { DomainError } from "../../domain/errors/DomainError";
import type { BillItemDto } from "../dtos/index";
import { mapBillItem } from "../dtos/mappers";

export type UpdateBillItemInput = {
  billId: string;
  itemId: string;
  name?: string;
  quantity?: number;
  unitPrice?: number;
  notes?: string | null;
  splitConfig?: { mode: string; entries: Array<{ participantId: string; value: number }> } | null;
};

export class UpdateBillItemUseCase {
  constructor(
    private readonly billRepository: IBillRepository,
    private readonly eventBus: IEventBus
  ) {}

  async execute(input: UpdateBillItemInput): Promise<BillItemDto> {
    const bill = await this.billRepository.findById(asBillId(input.billId));
    if (!bill) throw new BillNotFoundError(input.billId);

    const existingItem = bill.items.find((i) => i.id === input.itemId);
    if (!existingItem) {
      throw new DomainError(`Item "${input.itemId}" not found`, "ITEM_NOT_FOUND");
    }

    const newQuantity = input.quantity ?? existingItem.quantity;
    if (input.quantity !== undefined && (!Number.isInteger(input.quantity) || input.quantity < 1)) {
      throw new DomainError("Quantity must be a positive integer", "INVALID_QUANTITY");
    }

    const newUnitPrice = input.unitPrice ?? existingItem.unitPrice.amount;
    if (input.unitPrice !== undefined && input.unitPrice < 0) {
      throw new DomainError("Unit price cannot be negative", "INVALID_PRICE");
    }

    // Build split config from input if provided
    let newSplitConfig: ItemSplitConfig | null = existingItem.splitConfig;
    if (input.splitConfig !== undefined) {
      if (input.splitConfig === null) {
        newSplitConfig = null;
      } else {
        newSplitConfig = {
          mode: input.splitConfig.mode as ItemSplitConfig["mode"],
          entries: input.splitConfig.entries.map((e) => ({
            participantId: asParticipantId(e.participantId),
            value: e.value,
          })),
        };
      }
    }

    const updatedItem = createBillItem(
      existingItem.id,
      input.name?.trim() ?? existingItem.name,
      newQuantity,
      createMoney(newUnitPrice, bill.currency),
      input.notes !== undefined ? (input.notes?.trim() || null) : existingItem.notes,
      newSplitConfig
    );

    // If quantity decreased, remove assignments for unitIndices that no longer exist
    let assignments = bill.assignments;
    if (newQuantity < existingItem.quantity) {
      assignments = assignments.filter(
        (a) => !(a.billItemId === input.itemId && a.unitIndex >= newQuantity)
      );
    }

    const newItems = bill.items.map((i) => (i.id === input.itemId ? updatedItem : i));
    const { subtotal, total } = computeBillTotals(newItems, bill.currency, bill.tax, bill.discount, bill.tip);

    const updated = {
      ...bill,
      items: newItems,
      assignments,
      subtotal,
      total,
      updatedAt: new Date(),
    };

    await this.billRepository.save(updated);
    await this.eventBus.publish({
      type: "item.updated",
      billId: bill.id,
      payload: { itemId: input.itemId },
      occurredAt: new Date(),
    });

    return mapBillItem(updatedItem);
  }
}
