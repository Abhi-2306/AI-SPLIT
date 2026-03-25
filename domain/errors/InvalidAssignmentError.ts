import { DomainError } from "./DomainError";

export class InvalidAssignmentError extends DomainError {
  constructor(reason: string) {
    super(`Invalid assignment: ${reason}`, "INVALID_ASSIGNMENT");
    this.name = "InvalidAssignmentError";
  }
}
