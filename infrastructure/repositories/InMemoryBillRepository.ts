import type { IBillRepository } from "../../domain/repositories/IBillRepository";
import type { Bill } from "../../domain/entities/Bill";
import type { BillId } from "../../domain/value-objects/BrandedIds";

/**
 * In-memory bill repository using a module-scoped Map.
 * Uses globalThis to survive Next.js hot-module replacement in development.
 * Replaced with a database-backed implementation in Iteration 2.
 */
type GlobalWithStore = typeof globalThis & {
  __billStore: Map<BillId, Bill> | undefined;
};

const g = globalThis as GlobalWithStore;
if (!g.__billStore) {
  g.__billStore = new Map<BillId, Bill>();
}

export class InMemoryBillRepository implements IBillRepository {
  private readonly store: Map<BillId, Bill> = g.__billStore!;

  async findById(id: BillId): Promise<Bill | null> {
    return this.store.get(id) ?? null;
  }

  async save(bill: Bill): Promise<void> {
    this.store.set(bill.id, bill);
  }

  async delete(id: BillId): Promise<void> {
    this.store.delete(id);
  }
}
