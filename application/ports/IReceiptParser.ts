export type ParsedReceiptItem = {
  readonly name: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly rawLine: string;
  readonly confidence: "high" | "medium" | "low";
};

export type ParsedReceiptResult = {
  readonly items: ReadonlyArray<ParsedReceiptItem>;
  readonly detectedCurrency: string | null;
  readonly detectedTax: number | null;
  readonly detectedTip: number | null;
  readonly detectedTotal: number | null;
};

export interface IReceiptParser {
  /** Synchronous parse — for simple/regex-based implementations */
  parse(rawText: string): ParsedReceiptResult;
  /** Optional async parse — for AI-based implementations */
  parseAsync?(rawText: string): Promise<ParsedReceiptResult>;
}
