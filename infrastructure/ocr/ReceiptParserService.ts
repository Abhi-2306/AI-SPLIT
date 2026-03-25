import type {
  IReceiptParser,
  ParsedReceiptItem,
  ParsedReceiptResult,
} from "../../application/ports/IReceiptParser";

// ─── keyword filters ────────────────────────────────────────────────────────

const TAX_LINE = /\b(tax|gst|hst|pst|vat|cgst|sgst|igst|service\s*charge|service\s*tax|cess)\b/i;
const TIP_LINE = /\b(tip|gratuity|service\s*fee)\b/i;
const TOTAL_LINE = /\b(grand\s*total|amount\s*due|balance\s*due|net\s*total|total\s*amount|total\s*bill)\b/i;
const SUBTOTAL_LINE = /\b(sub\s*total|subtotal)\b/i;
const TOTAL_ONLY = /^\s*total\s*[:\s][\$₹€£]?\s*\d/i;
const DISCOUNT_LINE = /\b(discount|offer|promo|coupon|saving|off)\b/i;

// Lines that are definitely not items
const HARD_SKIP = /\b(receipt|invoice|thank\s*you|change|cash\s*paid|card\s*paid|payment|visa|mastercard|amex|rupay|upi|transaction|approval|auth|date|time|table\s*no|bill\s*no|order\s*no|server|cashier|waiter|tel|phone|mobile|address|email|www\.|http|gstin|cin\b|pan\b|fssai|license|reg\s*no|welcome|visit\s*again)\b/i;

// Lines that contain only numbers / dashes / symbols — not items
const NOISE_LINE = /^[\d\s\-_=*#|.,:;\/\\()]+$/;

// ─── currency detection ──────────────────────────────────────────────────────

const CURRENCY_SYMBOLS: Record<string, RegExp> = {
  INR: /₹/,
  USD: /\$/,
  EUR: /€/,
  GBP: /£/,
};

function detectCurrency(text: string): string | null {
  for (const [code, re] of Object.entries(CURRENCY_SYMBOLS)) {
    if (re.test(text)) return code;
  }
  return null;
}

// ─── amount extraction ───────────────────────────────────────────────────────

/**
 * Extracts the trailing price from a line.
 * Handles: "12.50", "12,50", "$12.50", "₹ 12", "1,234.56", "1234.56"
 */
function extractTrailingAmount(line: string): number | null {
  // Strip currency symbol at end and leading whitespace on it
  const cleaned = line.replace(/[\$₹€£]\s*/g, "");
  // Match last number in the line (may have commas as thousand-sep)
  const match = cleaned.match(/(\d{1,3}(?:[,\s]\d{3})*(?:\.\d{1,3})?|\d+(?:\.\d{1,3})?)[\s]*$/);
  if (!match) return null;
  const raw = match[1].replace(/,|\s/g, ""); // remove thousand separators
  const val = parseFloat(raw);
  return isNaN(val) ? null : val;
}

// ─── quantity extraction ─────────────────────────────────────────────────────

type QtyNameResult = { qty: number; name: string };

/**
 * Tries to extract a leading quantity from the item name portion.
 * Handles: "2x Pizza", "2 X Pizza", "Qty 2 Pizza", "Pizza x2", "(2) Pizza"
 */
function extractQtyFromName(raw: string): QtyNameResult {
  // Leading patterns: "2x", "2 x", "x2", "qty 2", "(2)"
  const leadingQty = raw.match(/^(\d+)\s*[xX\*]\s+(.+)$/);
  if (leadingQty) {
    const q = parseInt(leadingQty[1], 10);
    return { qty: isNaN(q) || q < 1 ? 1 : q, name: leadingQty[2].trim() };
  }

  const leadingQty2 = raw.match(/^[xX]\s*(\d+)\s+(.+)$/);
  if (leadingQty2) {
    const q = parseInt(leadingQty2[1], 10);
    return { qty: isNaN(q) || q < 1 ? 1 : q, name: leadingQty2[2].trim() };
  }

  const qtyKeyword = raw.match(/^(?:qty|quantity|pcs|nos|pc)\s*[:\-]?\s*(\d+)\s+(.+)$/i);
  if (qtyKeyword) {
    const q = parseInt(qtyKeyword[1], 10);
    return { qty: isNaN(q) || q < 1 ? 1 : q, name: qtyKeyword[2].trim() };
  }

  const paren = raw.match(/^\((\d+)\)\s*(.+)$/);
  if (paren) {
    const q = parseInt(paren[1], 10);
    return { qty: isNaN(q) || q < 1 ? 1 : q, name: paren[2].trim() };
  }

  // Trailing: "Pizza x2", "Pizza (2)", "Pizza - 2"
  const trailingQty = raw.match(/^(.+?)\s*[xX\*]\s*(\d+)\s*$/);
  if (trailingQty) {
    const q = parseInt(trailingQty[2], 10);
    return { qty: isNaN(q) || q < 1 ? 1 : q, name: trailingQty[1].trim() };
  }

  return { qty: 1, name: raw };
}

// ─── separator detection ─────────────────────────────────────────────────────

/**
 * Splits a line into [namePart, pricePart] by finding the last numeric token
 * and everything before it as the name.
 *
 * Real receipts use many separators: spaces, tabs, dots (leader), dashes.
 */
function splitNameAndPrice(line: string): [string, number] | null {
  // Normalize tabs and dot-leaders to spaces
  const normalized = line.replace(/\t/g, "  ").replace(/\.{2,}/g, "  ");

  const amount = extractTrailingAmount(normalized);
  if (amount === null || amount === 0) return null;

  // Remove the trailing price token from the line to get the name part
  const priceStr = amount.toString();
  // Find last occurrence of the price digits in the string
  const lastNumMatch = normalized.match(/^([\s\S]*?)\s*[\$₹€£]?\s*(\d{1,3}(?:[,\s]\d{3})*(?:\.\d{1,3})?|\d+(?:\.\d{1,3})?)\s*$/);
  if (!lastNumMatch) return null;

  const namePart = lastNumMatch[1].trim();
  if (!namePart || namePart.length < 2) return null;

  return [namePart, amount];
}

// ─── name cleanup ────────────────────────────────────────────────────────────

function cleanName(raw: string): string {
  return raw
    .replace(/^[-–—*#|:]+/, "")   // strip leading symbols
    .replace(/[-–—*#|:]+$/, "")   // strip trailing symbols
    .replace(/\s{2,}/g, " ")      // collapse spaces
    .trim();
}

function titleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function isValidName(name: string): boolean {
  if (name.length < 2) return false;
  // Must have at least one letter
  if (!/[a-zA-Z]/.test(name)) return false;
  return true;
}

// ─── main parser ─────────────────────────────────────────────────────────────

export class ReceiptParserService implements IReceiptParser {
  parse(rawText: string): ParsedReceiptResult {
    const detectedCurrency = detectCurrency(rawText);

    const lines = rawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length >= 3);

    const items: ParsedReceiptItem[] = [];
    let detectedTax: number | null = null;
    let detectedTip: number | null = null;
    let detectedTotal: number | null = null;

    for (const line of lines) {
      // Hard skip — clearly not items
      if (HARD_SKIP.test(line)) continue;
      if (NOISE_LINE.test(line)) continue;

      // Tax
      if (TAX_LINE.test(line)) {
        const amt = extractTrailingAmount(line);
        if (amt !== null) detectedTax = amt;
        continue;
      }

      // Tip
      if (TIP_LINE.test(line)) {
        const amt = extractTrailingAmount(line);
        if (amt !== null) detectedTip = amt;
        continue;
      }

      // Subtotal — skip
      if (SUBTOTAL_LINE.test(line)) continue;

      // Total (grand total / amount due / etc.)
      if (TOTAL_LINE.test(line) || TOTAL_ONLY.test(line)) {
        const amt = extractTrailingAmount(line);
        if (amt !== null) detectedTotal = amt;
        continue;
      }

      // Discount — skip
      if (DISCOUNT_LINE.test(line)) continue;

      // ── Try to parse as item ──────────────────────────────────────────────

      const split = splitNameAndPrice(line);
      if (!split) continue;

      const [rawName, price] = split;
      const cleaned = cleanName(rawName);
      if (!isValidName(cleaned)) continue;

      // Price sanity: skip if looks like a year or phone number fragment
      if (price > 100000) continue;

      const { qty, name: finalName } = extractQtyFromName(cleaned);
      const cleanedFinalName = titleCase(cleanName(finalName));
      if (!isValidName(cleanedFinalName)) continue;

      // Confidence: high if price > 0 and name clearly has letters; medium otherwise
      const confidence: "high" | "medium" | "low" =
        price > 0 && /[a-zA-Z]{2,}/.test(cleanedFinalName) ? "high" : "medium";

      items.push({
        name: cleanedFinalName,
        quantity: qty,
        unitPrice: qty > 1 ? price / qty : price,
        rawLine: line,
        confidence,
      });
    }

    return { items, detectedCurrency, detectedTax, detectedTip, detectedTotal };
  }
}
