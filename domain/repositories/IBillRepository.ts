import type { Bill } from "../entities/Bill";
import type { BillId } from "../value-objects/BrandedIds";

export interface IBillRepository {
  findById(id: BillId): Promise<Bill | null>;
  save(bill: Bill): Promise<void>;
  delete(id: BillId): Promise<void>;
}
