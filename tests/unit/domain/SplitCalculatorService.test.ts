import { describe, it, expect } from "vitest";
import { calculateSplit } from "../../../domain/services/SplitCalculatorService";
import type { Bill } from "../../../domain/entities/Bill";
import { createBillItem } from "../../../domain/entities/BillItem";
import { createMoney, zeroMoney } from "../../../domain/value-objects/Money";
import { asBillId, asBillItemId, asParticipantId, asAssignmentId } from "../../../domain/value-objects/BrandedIds";

function makeBill(overrides: Partial<Bill> = {}): Bill {
  return {
    id: asBillId("bill-1"),
    title: "Test Bill",
    currency: "INR",
    items: [],
    participants: [],
    assignments: [],
    subtotal: zeroMoney("INR"),
    tax: null,
    discount: null,
    tip: null,
    total: zeroMoney("INR"),
    status: "draft",
    paidByParticipantId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("SplitCalculatorService", () => {
  it("returns empty splits for empty bill", () => {
    const bill = makeBill();
    const result = calculateSplit(bill);
    expect(result.participantSplits).toHaveLength(0);
    expect(result.isComplete).toBe(true);
  });

  it("treats items with no assignments as equally split (not unassigned)", () => {
    const item = createBillItem(
      asBillItemId("item-1"),
      "Pizza",
      3,
      createMoney(100, "INR")
    );
    const bill = makeBill({ items: [item], subtotal: createMoney(300, "INR"), total: createMoney(300, "INR") });
    const result = calculateSplit(bill);
    // Items never touched by user default to "equally split" — not flagged as unassigned
    expect(result.unassignedUnits).toHaveLength(0);
    expect(result.isComplete).toBe(true);
  });

  it("marks partially-assigned units as unassigned", () => {
    const item = createBillItem(
      asBillItemId("item-1"),
      "Pizza",
      3,
      createMoney(100, "INR")
    );
    const john = { id: asParticipantId("john"), name: "John", userId: null, createdAt: new Date() };
    // Only unit 0 is assigned — units 1 and 2 should be flagged as unassigned
    const bill = makeBill({
      items: [item],
      participants: [john],
      assignments: [
        { id: asAssignmentId("a1"), billItemId: item.id, participantId: john.id, unitIndex: 0 },
      ],
      subtotal: createMoney(300, "INR"),
      total: createMoney(300, "INR"),
    });
    const result = calculateSplit(bill);
    expect(result.unassignedUnits).toHaveLength(2);
    expect(result.isComplete).toBe(false);
  });

  it("correctly splits one item among two participants by quantity", () => {
    const item = createBillItem(
      asBillItemId("pizza"),
      "Pizza",
      2,
      createMoney(100, "INR") // 100 per unit, 200 total
    );
    const john = { id: asParticipantId("john"), name: "John", userId: null, createdAt: new Date() };
    const alice = { id: asParticipantId("alice"), name: "Alice", userId: null, createdAt: new Date() };

    const bill = makeBill({
      items: [item],
      participants: [john, alice],
      assignments: [
        { id: asAssignmentId("a1"), billItemId: item.id, participantId: john.id, unitIndex: 0 },
        { id: asAssignmentId("a2"), billItemId: item.id, participantId: alice.id, unitIndex: 1 },
      ],
      subtotal: createMoney(200, "INR"),
      total: createMoney(200, "INR"),
    });

    const result = calculateSplit(bill);
    expect(result.isComplete).toBe(true);
    expect(result.unassignedUnits).toHaveLength(0);

    const johnSplit = result.participantSplits.find((s) => s.participant.id === john.id)!;
    const aliceSplit = result.participantSplits.find((s) => s.participant.id === alice.id)!;

    expect(johnSplit.subtotal.amount).toBe(100); // 1/2 of 200
    expect(aliceSplit.subtotal.amount).toBe(100);
    expect(johnSplit.total.amount).toBe(100);
    expect(aliceSplit.total.amount).toBe(100);
  });

  it("handles shared unit (two people share one unit equally split by other units)", () => {
    // Pizza qty=3: John gets #0, Alice gets #1, John also gets #2
    const item = createBillItem(
      asBillItemId("pizza"),
      "Pizza",
      3,
      createMoney(10, "INR") // 10 per unit, 30 total
    );
    const john = { id: asParticipantId("john"), name: "John", userId: null, createdAt: new Date() };
    const alice = { id: asParticipantId("alice"), name: "Alice", userId: null, createdAt: new Date() };

    const bill = makeBill({
      items: [item],
      participants: [john, alice],
      assignments: [
        { id: asAssignmentId("a1"), billItemId: item.id, participantId: john.id, unitIndex: 0 },
        { id: asAssignmentId("a2"), billItemId: item.id, participantId: alice.id, unitIndex: 1 },
        { id: asAssignmentId("a3"), billItemId: item.id, participantId: john.id, unitIndex: 2 },
      ],
      subtotal: createMoney(30, "INR"),
      total: createMoney(30, "INR"),
    });

    const result = calculateSplit(bill);
    const johnSplit = result.participantSplits.find((s) => s.participant.id === john.id)!;
    const aliceSplit = result.participantSplits.find((s) => s.participant.id === alice.id)!;

    // John: 2/3 of 30 = 20, Alice: 1/3 of 30 ≈ 10
    expect(johnSplit.subtotal.amount).toBeCloseTo(20);
    expect(aliceSplit.subtotal.amount).toBeCloseTo(10);
  });

  it("distributes tax proportionally", () => {
    const item = createBillItem(
      asBillItemId("item-1"),
      "Burger",
      2,
      createMoney(100, "INR")
    );
    const john = { id: asParticipantId("john"), name: "John", userId: null, createdAt: new Date() };
    const alice = { id: asParticipantId("alice"), name: "Alice", userId: null, createdAt: new Date() };

    const bill = makeBill({
      items: [item],
      participants: [john, alice],
      assignments: [
        { id: asAssignmentId("a1"), billItemId: item.id, participantId: john.id, unitIndex: 0 },
        { id: asAssignmentId("a2"), billItemId: item.id, participantId: alice.id, unitIndex: 1 },
      ],
      subtotal: createMoney(200, "INR"),
      tax: createMoney(20, "INR"),
      tip: null,
      total: createMoney(220, "INR"),
    });

    const result = calculateSplit(bill);
    const johnSplit = result.participantSplits.find((s) => s.participant.id === john.id)!;
    const aliceSplit = result.participantSplits.find((s) => s.participant.id === alice.id)!;

    // Each has 50% of subtotal → each gets 50% of tax = 10
    expect(johnSplit.taxShare.amount).toBeCloseTo(10);
    expect(aliceSplit.taxShare.amount).toBeCloseTo(10);
    expect(johnSplit.total.amount).toBeCloseTo(110);
    expect(aliceSplit.total.amount).toBeCloseTo(110);
  });

  it("exact floating point amounts preserved", () => {
    const item = createBillItem(
      asBillItemId("item-1"),
      "Dish",
      3,
      createMoney(10, "INR") // 10 per unit, 30 total
    );
    const john = { id: asParticipantId("john"), name: "John", userId: null, createdAt: new Date() };

    const bill = makeBill({
      items: [item],
      participants: [john],
      assignments: [
        { id: asAssignmentId("a1"), billItemId: item.id, participantId: john.id, unitIndex: 0 },
        { id: asAssignmentId("a2"), billItemId: item.id, participantId: john.id, unitIndex: 1 },
        { id: asAssignmentId("a3"), billItemId: item.id, participantId: john.id, unitIndex: 2 },
      ],
      subtotal: createMoney(30, "INR"),
      total: createMoney(30, "INR"),
    });

    const result = calculateSplit(bill);
    const johnSplit = result.participantSplits.find((s) => s.participant.id === john.id)!;
    // All 3 units → full price
    expect(johnSplit.total.amount).toBe(30);
  });
});
