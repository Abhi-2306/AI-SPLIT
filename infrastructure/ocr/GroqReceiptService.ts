import Groq from "groq-sdk";
import type { IReceiptExtractorService } from "../../application/ports/IReceiptExtractorService";
import type { OcrResultDto, ParsedItemDto } from "../../application/dtos/index";

// ─── Prompt ─────────────────────────────────────────────────────────────────

const EXTRACTION_PROMPT = `You are an expert receipt and bill parser.

Analyze the receipt content and extract all purchased items.

Return ONLY valid JSON — no markdown, no explanation, no code fences. Use exactly this schema:
{
  "rawText": "full readable text you can see on the receipt",
  "items": [
    {
      "name": "Clean product/dish name including any size/count/weight descriptor (title-cased, fix OCR typos)",
      "quantity": 1,
      "unitPrice": 0.00,
      "confidence": "high"
    }
  ],
  "detectedCurrency": "USD",
  "detectedTax": 3.25,
  "detectedDiscount": 2.00,
  "detectedTip": null,
  "detectedTotal": 38.75
}

Rules:
- Include ONLY actual purchased grocery/food/product items — things a person physically bought.
- A real item line looks like: a product name (often with brand, weight, count) followed by "N x $price" or just a price.
- SKIP ALL of these — do NOT add them to items under any circumstances:
    • Store name, address, phone, date/time, order ID, item ID numbers, cashier name, barcode
    • Loyalty savings / loyalty points lines ("Loyalty savings: $X")
    • Payment method lines (Visa, Mastercard, card ending in XXXX)
    • Thank you / confirmation messages
    • Tax, GST, VAT, service charge, service fee, delivery fee, convenience fee lines
    • Tip or gratuity lines
    • Subtotal, total, grand total, amount due lines
    • Discount, promotion, credit lines — capture their VALUE in detectedDiscount instead
    • Any line containing "Additional charge for order", "Reconciliation", "Instacart credit",
      "Total charged", "authorized for", "hold removed", "statement", "Learn more",
      "temporarily authorized", "delivery id", "membership", "Instacart+"
    • Section headings like "CHARGES", "ORDER TOTALS", "ITEMS FOUND", category labels
      (BAKERY, DAIRY & EGGS, PRODUCE, HEALTH & PERSONAL CARE, etc.)
- Stop extracting items when you hit a section heading like "CHARGES", "ORDER TOTALS",
  "Items Subtotal", or any payment/reconciliation block. Only items before that block count.
  If the same receipt section repeats (e.g. "ITEMS FOUND" appears twice), collect items from ALL item sections.
- quantity: the NUMBER OF SEPARATE identical items purchased on this line — almost always 1.
  What IS quantity: "2x Burger" → quantity=2 | "3 bottles water" → quantity=3.
  What is NOT quantity (these are product descriptors — keep in the name, set quantity=1):
    • Pack/bundle sizes: "35 count", "12 pk", "6-pack", "24ct", "18-pack" → quantity=1, name="Coke 35 Count"
    • Weight/volume: "5 lbs", "2 kg", "500ml", "1.5L" → quantity=1, name="Dahi 5 Lbs"
    • Size words: "large", "XL", "family size"
- unitPrice: price for the whole line ÷ quantity. If line shows "3x Pizza 300", unitPrice=100.
- confidence: "high" = clearly readable, "medium" = somewhat uncertain, "low" = heavily guessed.
- detectedTax: ONLY use the primary order summary section (near "Items Subtotal"). Sum all fees added on top of item subtotal — service fee, delivery fee, GST, VAT, surcharge, etc. Ignore any "Additional charge", "Reconciliation", or post-delivery adjustment amounts. null if none.
- detectedDiscount: ONLY from the primary order summary section. Sum ALL discounts/promotions as a POSITIVE number (e.g. "Scheduled delivery discount -$2.00" → detectedDiscount = 2.00). Ignore post-delivery credit adjustments. null if no discount.
- detectedTip: tip or gratuity amount from the primary order summary only (null if none).
- detectedTotal: the primary order total (near "Items Subtotal") — NOT "Total charged" which includes post-delivery adjustments.
- detectedCurrency: ISO code (USD, INR, EUR, GBP) inferred from $, ₹, €, £ or text like "Rs.", "USD".
- Fix obvious OCR errors in names (e.g. "P1ZZA" → "Pizza", "CHIKN" → "Chicken").`;

// ─── Response type ───────────────────────────────────────────────────────────

// LLMs don't always honour JSON number types — use string | number for numeric fields
// so the filter/map can coerce them correctly with Number().
type GroqResponse = {
  rawText?: string;
  items?: Array<{
    name: string;
    quantity: number | string;
    unitPrice: number | string;
    confidence: string;
  }>;
  detectedCurrency?: string | null;
  detectedTax?: number | string | null;
  detectedDiscount?: number | string | null;
  detectedTip?: number | string | null;
  detectedTotal?: number | string | null;
};

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * Uses Groq (free tier) with Llama 3.2 Vision to extract and parse receipts.
 *
 * Images  → Llama 3.2 Vision (base64 inline, sees the image directly)
 * PDFs    → pdf-parse extracts text → Llama 3.3 text model parses it
 *
 * Get a free API key at https://console.groq.com
 */
export class GroqReceiptService implements IReceiptExtractorService {
  private readonly client: Groq;

  constructor() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY is not set in environment variables.");
    this.client = new Groq({ apiKey });
  }

  async extractAndParse(buffer: Buffer, mimeType: string): Promise<OcrResultDto> {
    const start = Date.now();

    if (mimeType === "application/pdf") {
      return this.processPdf(buffer, start);
    }
    return this.processImage(buffer, mimeType, start);
  }

  // ── Image path: send directly to Llama Vision ────────────────────────────

  private async processImage(
    buffer: Buffer,
    mimeType: string,
    start: number
  ): Promise<OcrResultDto> {
    const base64 = buffer.toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const response = await this.client.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: EXTRACTION_PROMPT },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      temperature: 0,
    });

    const responseText = response.choices[0]?.message?.content ?? "";
    console.log("[GroqReceiptService] Image raw response:", responseText.slice(0, 500));
    return this.buildDto(responseText, Date.now() - start);
  }

  // ── PDF path: extract text first, then ask Llama to parse it ─────────────

  private async processPdf(buffer: Buffer, start: number): Promise<OcrResultDto> {
    const emptyResult: OcrResultDto = {
      rawText: "",
      confidence: 0,
      processingTimeMs: Date.now() - start,
      parsedItems: [],
      detectedCurrency: null,
      detectedTax: null,
      detectedDiscount: null,
      detectedTip: null,
      detectedTotal: null,
    };

    try {
      // pdf-parse is a pure Node.js library — works in all serverless environments
      // (no browser globals like DOMMatrix required, unlike pdfjs-dist).
      // pdf-parse v1.x — pure Node.js, no browser globals required
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse: (buf: Buffer) => Promise<{ text: string }> = require("pdf-parse");
      const data = await pdfParse(buffer);
      const extractedText = data.text;

      if (!extractedText.trim()) {
        console.warn("[GroqReceiptService] PDF produced no extractable text.");
        return emptyResult;
      }

      const response = await this.client.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "user", content: `${EXTRACTION_PROMPT}\n\nReceipt text:\n\n${extractedText}` },
        ],
        temperature: 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        response_format: { type: "json_object" } as any,
      });

      const responseText = response.choices[0]?.message?.content ?? "";
      console.log("[GroqReceiptService] PDF raw response:", responseText.slice(0, 500));
      return this.buildDto(responseText, Date.now() - start, extractedText);
    } catch (err) {
      console.error("[GroqReceiptService] PDF parsing failed:", err);
      return { ...emptyResult, processingTimeMs: Date.now() - start };
    }
  }

  // ── Parse Groq's JSON response into OcrResultDto ─────────────────────────

  private buildDto(
    responseText: string,
    processingTimeMs: number,
    fallbackRawText = ""
  ): OcrResultDto {
    const parsed = this.safeParseJson(responseText);

    const parsedItems: ParsedItemDto[] = (parsed.items ?? [])
      .filter((item) => {
        // Accept both number and string prices — LLMs sometimes return "10.00" instead of 10.00
        const price = Number(item.unitPrice);
        return item.name && !isNaN(price) && price >= 0;
      })
      .map((item) => ({
        name: String(item.name).trim(),
        quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
        unitPrice: Number(item.unitPrice),
        rawLine: "",
        confidence: (["high", "medium", "low"].includes(item.confidence)
          ? item.confidence
          : "medium") as "high" | "medium" | "low",
      }));

    const toNum = (v: number | string | null | undefined): number | null => {
      if (v == null) return null;
      const n = Number(v);
      return isNaN(n) ? null : n;
    };

    return {
      rawText: parsed.rawText ?? fallbackRawText ?? responseText,
      confidence: 1.0,
      processingTimeMs,
      parsedItems,
      detectedCurrency: parsed.detectedCurrency ?? null,
      detectedTax: toNum(parsed.detectedTax),
      detectedDiscount: toNum(parsed.detectedDiscount),
      detectedTip: toNum(parsed.detectedTip),
      detectedTotal: toNum(parsed.detectedTotal),
    };
  }

  private safeParseJson(text: string): GroqResponse {
    try {
      const cleaned = text
        .replace(/^```(?:json)?\s*/im, "")
        .replace(/\s*```\s*$/m, "")
        .trim();
      return JSON.parse(cleaned);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try { return JSON.parse(match[0]); } catch { /* ignore */ }
      }
      return { items: [], rawText: text };
    }
  }
}
