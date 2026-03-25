import { DomainError } from "./DomainError";

export class BillNotFoundError extends DomainError {
  constructor(billId: string) {
    super(`Bill with id "${billId}" not found`, "BILL_NOT_FOUND");
    this.name = "BillNotFoundError";
  }
}
