import type { IBillRepository } from "../../domain/repositories/IBillRepository";
import { asBillId } from "../../domain/value-objects/BrandedIds";
import type { BillDto } from "../dtos/index";
import { mapBill } from "../dtos/mappers";

export class GetBillUseCase {
  constructor(private readonly billRepository: IBillRepository) {}

  async execute(billId: string): Promise<BillDto | null> {
    const bill = await this.billRepository.findById(asBillId(billId));
    return bill ? mapBill(bill) : null;
  }
}
