import type { IBillRepository } from "../../domain/repositories/IBillRepository";
import type { IEventBus } from "../ports/IEventBus";
import type { Bill } from "../../domain/entities/Bill";
import { computeBillTotals } from "../../domain/entities/Bill";
import { asBillId } from "../../domain/value-objects/BrandedIds";
import { zeroMoney } from "../../domain/value-objects/Money";
import { generateId } from "../../lib/utils/idGenerator";
import type { BillDto } from "../dtos/index";
import { mapBill } from "../dtos/mappers";

export type CreateBillInput = {
  title: string;
  currency: string;
};

export class CreateBillUseCase {
  constructor(
    private readonly billRepository: IBillRepository,
    private readonly eventBus: IEventBus
  ) {}

  async execute(input: CreateBillInput): Promise<BillDto> {
    const { subtotal, total } = computeBillTotals([], input.currency, null, null, null);
    const now = new Date();

    const bill: Bill = {
      id: asBillId(generateId()),
      title: input.title,
      currency: input.currency,
      items: [],
      participants: [],
      assignments: [],
      subtotal,
      tax: null,
      discount: null,
      tip: null,
      total,
      status: "draft",
      paidByParticipantId: null,
      createdAt: now,
      updatedAt: now,
    };

    await this.billRepository.save(bill);
    await this.eventBus.publish({
      type: "bill.created",
      billId: bill.id,
      payload: { title: bill.title },
      occurredAt: now,
    });

    return mapBill(bill);
  }
}
