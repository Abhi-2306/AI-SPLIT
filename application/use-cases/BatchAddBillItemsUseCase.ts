import type { IBillRepository } from "../../domain/repositories/IBillRepository";
import type { IEventBus } from "../ports/IEventBus";
import { asBillId, asBillItemId } from "../../domain/value-objects/BrandedIds";
import { createMoney } from "../../domain/value-objects/Money";
import { createBillItem } from "../../domain/entities/BillItem";
import { computeBillTotals } from "../../domain/entities/Bill";
import { BillNotFoundError } from "../../domain/errors/BillNotFoundError";
import { DomainError } from "../../domain/errors/DomainError";
import { generateId } from "../../lib/utils/idGenerator";
import type { BillItemDto } from "../dtos/index";
import { mapBillItem } from "../dtos/mappers";

export type BatchAddBillItemsInput = {
  billId: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    notes?: string;
  }>;
};

export class BatchAddBillItemsUseCase {
  constructor(
    private readonly billRepository: IBillRepository,
    private readonly eventBus: IEventBus
  ) {}

  async execute(input: BatchAddBillItemsInput): Promise<BillItemDto[]> {
    const bill = await this.billRepository.findById(asBillId(input.billId));
    if (!bill) throw new BillNotFoundError(input.billId);

    if (input.items.length === 0) return [];

    const newItems = input.items.map((i) => {
      if (!i.name.trim()) throw new DomainError("Item name cannot be empty", "INVALID_ITEM_NAME");
      if (!Number.isInteger(i.quantity) || i.quantity < 1)
        throw new DomainError("Quantity must be a positive integer", "INVALID_QUANTITY");
      if (i.unitPrice < 0) throw new DomainError("Unit price cannot be negative", "INVALID_PRICE");
      return createBillItem(
        asBillItemId(generateId()),
        i.name.trim(),
        i.quantity,
        createMoney(i.unitPrice, bill.currency),
        i.notes?.trim() || null
      );
    });

    const allItems = [...bill.items, ...newItems];
    const { subtotal, total } = computeBillTotals(allItems, bill.currency, bill.tax, bill.tip);

    await this.billRepository.save({
      ...bill,
      items: allItems,
      subtotal,
      total,
      updatedAt: new Date(),
    });

    await this.eventBus.publish({
      type: "item.added",
      billId: bill.id,
      payload: { count: newItems.length },
      occurredAt: new Date(),
    });

    return newItems.map(mapBillItem);
  }
}
