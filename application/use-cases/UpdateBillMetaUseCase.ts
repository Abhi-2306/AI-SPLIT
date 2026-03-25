import type { IBillRepository } from "../../domain/repositories/IBillRepository";
import { asBillId, asParticipantId } from "../../domain/value-objects/BrandedIds";
import { InvalidAssignmentError } from "../../domain/errors/InvalidAssignmentError";
import { createMoney } from "../../domain/value-objects/Money";
import { computeBillTotals } from "../../domain/entities/Bill";
import { BillNotFoundError } from "../../domain/errors/BillNotFoundError";
import type { BillDto } from "../dtos/index";
import { mapBill } from "../dtos/mappers";

export type UpdateBillMetaInput = {
  billId: string;
  title?: string;
  tax?: number | null;
  tip?: number | null;
  paidByParticipantId?: string | null;
};

export class UpdateBillMetaUseCase {
  constructor(private readonly billRepository: IBillRepository) {}

  async execute(input: UpdateBillMetaInput): Promise<BillDto> {
    const bill = await this.billRepository.findById(asBillId(input.billId));
    if (!bill) throw new BillNotFoundError(input.billId);

    const newTax =
      input.tax !== undefined
        ? input.tax !== null ? createMoney(input.tax, bill.currency) : null
        : bill.tax;

    const newTip =
      input.tip !== undefined
        ? input.tip !== null ? createMoney(input.tip, bill.currency) : null
        : bill.tip;

    const { subtotal, total } = computeBillTotals(bill.items, bill.currency, newTax, newTip);

    let newPaidBy = bill.paidByParticipantId;
    if (input.paidByParticipantId !== undefined) {
      if (input.paidByParticipantId === null) {
        newPaidBy = null;
      } else {
        const exists = bill.participants.some((p) => p.id === input.paidByParticipantId);
        if (!exists) throw new InvalidAssignmentError(`Participant "${input.paidByParticipantId}" not found`);
        newPaidBy = asParticipantId(input.paidByParticipantId);
      }
    }

    const updated = {
      ...bill,
      title: input.title ?? bill.title,
      tax: newTax,
      tip: newTip,
      paidByParticipantId: newPaidBy,
      subtotal,
      total,
      updatedAt: new Date(),
    };

    await this.billRepository.save(updated);
    return mapBill(updated);
  }
}
