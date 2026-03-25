import type { IBillRepository } from "../../domain/repositories/IBillRepository";
import type { IEventBus } from "../ports/IEventBus";
import { asBillId } from "../../domain/value-objects/BrandedIds";
import { computeBillTotals } from "../../domain/entities/Bill";
import { BillNotFoundError } from "../../domain/errors/BillNotFoundError";
import { DomainError } from "../../domain/errors/DomainError";

export type DeleteBillItemInput = {
  billId: string;
  itemId: string;
};

export class DeleteBillItemUseCase {
  constructor(
    private readonly billRepository: IBillRepository,
    private readonly eventBus: IEventBus
  ) {}

  async execute(input: DeleteBillItemInput): Promise<void> {
    const bill = await this.billRepository.findById(asBillId(input.billId));
    if (!bill) throw new BillNotFoundError(input.billId);

    const exists = bill.items.some((i) => i.id === input.itemId);
    if (!exists) {
      throw new DomainError(`Item "${input.itemId}" not found`, "ITEM_NOT_FOUND");
    }

    const newItems = bill.items.filter((i) => i.id !== input.itemId);
    const newAssignments = bill.assignments.filter((a) => a.billItemId !== input.itemId);
    const { subtotal, total } = computeBillTotals(newItems, bill.currency, bill.tax, bill.tip);

    const updated = {
      ...bill,
      items: newItems,
      assignments: newAssignments,
      subtotal,
      total,
      updatedAt: new Date(),
    };

    await this.billRepository.save(updated);
    await this.eventBus.publish({
      type: "item.deleted",
      billId: bill.id,
      payload: { itemId: input.itemId },
      occurredAt: new Date(),
    });
  }
}
