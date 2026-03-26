import type { IBillRepository } from "../../domain/repositories/IBillRepository";
import { asBillId } from "../../domain/value-objects/BrandedIds";
import { calculateSplit } from "../../domain/services/SplitCalculatorService";
import { BillNotFoundError } from "../../domain/errors/BillNotFoundError";
import type { SplitResultDto } from "../dtos/index";
import { mapSplitResult } from "../dtos/mappers";

export class CalculateSplitUseCase {
  constructor(private readonly billRepository: IBillRepository) {}

  async execute(billId: string): Promise<SplitResultDto> {
    const bill = await this.billRepository.findById(asBillId(billId));
    if (!bill) throw new BillNotFoundError(billId);

    const result = calculateSplit(bill);

    // Persist the status based on whether the split is complete
    const newStatus = result.isComplete ? "assigned" : "draft";
    if (bill.status !== newStatus) {
      await this.billRepository.save({
        ...bill,
        status: newStatus,
        updatedAt: new Date(),
      });
    }

    return mapSplitResult(result);
  }
}
