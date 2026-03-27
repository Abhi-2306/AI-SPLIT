export type ParticipantDto = {
  id: string;
  name: string;
  userId: string | null;
  createdAt: string;
};

export type AssignmentDto = {
  id: string;
  billItemId: string;
  participantId: string;
  unitIndex: number;
};

export type SplitEntryDto = {
  participantId: string;
  value: number;
};

export type ItemSplitConfigDto = {
  mode: "equally" | "by_count" | "by_percentage" | "by_shares" | "by_amount";
  entries: SplitEntryDto[];
};

export type BillItemDto = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes: string | null;
  splitConfig: ItemSplitConfigDto | null;
};

export type BillDto = {
  id: string;
  title: string;
  currency: string;
  items: BillItemDto[];
  participants: ParticipantDto[];
  assignments: AssignmentDto[];
  subtotal: number;
  tax: number | null;
  tip: number | null;
  total: number;
  status: "draft" | "assigned" | "settled";
  paidByParticipantId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OcrResultDto = {
  rawText: string;
  confidence: number;
  processingTimeMs: number;
  parsedItems: ParsedItemDto[];
  detectedCurrency: string | null;
  detectedTax: number | null;
  detectedDiscount: number | null;
  detectedTip: number | null;
  detectedTotal: number | null;
};

export type ParsedItemDto = {
  name: string;
  quantity: number;
  unitPrice: number;
  rawLine: string;
  confidence: "high" | "medium" | "low";
};

export type ItemShareDto = {
  item: BillItemDto;
  assignedUnitIndices: number[];
  amountOwed: number;
};

export type ParticipantSplitDto = {
  participant: ParticipantDto;
  itemShares: ItemShareDto[];
  subtotal: number;
  taxShare: number;
  tipShare: number;
  total: number;
};

export type UnassignedUnitDto = {
  item: BillItemDto;
  unitIndex: number;
};

export type SettlementDto = {
  from: ParticipantDto;
  to: ParticipantDto;
  amount: number;
};

export type SplitResultDto = {
  billId: string;
  participantSplits: ParticipantSplitDto[];
  unassignedUnits: UnassignedUnitDto[];
  settlements: SettlementDto[];
  isComplete: boolean;
  calculatedAt: string;
};
