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

export type AddBillItemInput = {
  billId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
};

export class AddBillItemUseCase {
  constructor(
    private readonly billRepository: IBillRepository,
    private readonly eventBus: IEventBus
  ) {}

  async execute(input: AddBillItemInput): Promise<BillItemDto> {
    const bill = await this.billRepository.findById(asBillId(input.billId));
    if (!bill) throw new BillNotFoundError(input.billId);

    if (!input.name.trim()) {
      throw new DomainError("Item name cannot be empty", "INVALID_ITEM_NAME");
    }
    if (!Number.isInteger(input.quantity) || input.quantity < 1) {
      throw new DomainError("Quantity must be a positive integer", "INVALID_QUANTITY");
    }
    if (input.unitPrice < 0) {
      throw new DomainError("Unit price cannot be negative", "INVALID_PRICE");
    }

    const item = createBillItem(
      asBillItemId(generateId()),
      input.name.trim(),
      input.quantity,
      createMoney(input.unitPrice, bill.currency),
      input.notes?.trim() || null
    );

    const newItems = [...bill.items, item];
    const { subtotal, total } = computeBillTotals(newItems, bill.currency, bill.tax, bill.tip);

    const updated = {
      ...bill,
      items: newItems,
      subtotal,
      total,
      updatedAt: new Date(),
    };

    await this.billRepository.save(updated);
    await this.eventBus.publish({
      type: "item.added",
      billId: bill.id,
      payload: { itemId: item.id },
      occurredAt: new Date(),
    });

    return mapBillItem(item);
  }
}
