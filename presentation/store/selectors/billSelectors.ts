import type { BillDto } from "@/application/dtos/index";

/**
 * Pure selector functions — derived state from BillDto.
 * These drive the BillStepper validation logic.
 */

export function canProceedToParticipants(bill: BillDto | null): boolean {
  return bill !== null && bill.items.length > 0;
}

export function canProceedToAssign(bill: BillDto | null): boolean {
  return bill !== null && bill.items.length > 0 && bill.participants.length > 0;
}

export function canProceedToSummary(bill: BillDto | null): boolean {
  if (!bill || bill.items.length === 0) return false;
  // Every item must have at least one participant assigned to it
  return bill.items.every((item) =>
    bill.assignments.some((a) => a.billItemId === item.id)
  );
}

export function getTotalUnits(bill: BillDto | null): number {
  if (!bill) return 0;
  return bill.items.length;
}

export function getAssignedUnits(bill: BillDto | null): number {
  if (!bill) return 0;
  // Count items that have at least one assignment
  return bill.items.filter((item) =>
    bill.assignments.some((a) => a.billItemId === item.id)
  ).length;
}

export function getAssignmentForUnit(
  bill: BillDto | null,
  itemId: string,
  unitIndex: number
): { participantId: string } | null {
  if (!bill) return null;
  const assignment = bill.assignments.find(
    (a) => a.billItemId === itemId && a.unitIndex === unitIndex
  );
  return assignment ? { participantId: assignment.participantId } : null;
}

export function getAssignmentsForUnit(
  bill: BillDto | null,
  itemId: string,
  unitIndex: number
): string[] {
  if (!bill) return [];
  return bill.assignments
    .filter((a) => a.billItemId === itemId && a.unitIndex === unitIndex)
    .map((a) => a.participantId);
}

export function getParticipantColor(index: number): string {
  const colors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-orange-500",
    "bg-pink-500",
    "bg-teal-500",
    "bg-red-500",
    "bg-yellow-500",
  ];
  return colors[index % colors.length];
}
