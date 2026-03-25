import {
  GoogleGenerativeAI,
  type GenerativeModel,
} from "@google/generative-ai";
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
      "name": "Clean product/dish name (title-cased, fix OCR typos)",
      "quantity": 1,
      "unitPrice": 0.00,
      "confidence": "high"
    }
  ],
  "detectedCurrency": "INR",
  "detectedTax": null,
  "detectedTip": null,
  "detectedTotal": null
}

Rules:
- Include ONLY actual purchased items (food, products, services).
- SKIP: store name, address, phone, date/time, order/bill/table number, cashier, barcode, loyalty points, payment method, "thank you" lines.
- quantity: positive integer — default 1 if not printed.
- unitPrice: price per ONE unit. If line shows "3x Pizza 300", unitPrice = 100.
- confidence: "high" = clearly readable, "medium" = somewhat uncertain, "low" = heavily guessed.
- detectedTax: the tax / GST / VAT / service charge amount (a number, not a percent).
- detectedTip: tip or gratuity amount.
- detectedTotal: grand total or amount due.
- detectedCurrency: ISO code (INR, USD, EUR, GBP) inferred from ₹/$€£ or text like "Rs.", "INR".
- Fix obvious OCR errors in names (e.g. "P1ZZA" → "Pizza", "CHIKN" → "Chicken").`;

// ─── Response type ───────────────────────────────────────────────────────────

type GeminiResponse = {
  rawText?: string;
  items?: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    confidence: string;
  }>;
  detectedCurrency?: string | null;
  detectedTax?: number | null;
  detectedTip?: number | null;
  detectedTotal?: number | null;
};

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * Uses Google Gemini (free tier) to extract and parse receipts.
 *
 * Images  → Gemini Vision (sees the image directly, no Tesseract needed)
 * PDFs    → pdf-parse extracts text → Gemini text model parses it
 *
 * Free tier: 1,500 requests/day, 1M tokens/day on gemini-1.5-flash.
 * Get a free API key at https://aistudio.google.com/app/apikey
 */
export class GeminiReceiptService implements IReceiptExtractorService {
  private readonly model: GenerativeModel;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set in environment variables.");
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  }

  async extractAndParse(buffer: Buffer, mimeType: string): Promise<OcrResultDto> {
    const start = Date.now();

    if (mimeType === "application/pdf") {
      return this.processPdf(buffer, start);
    }
    return this.processImage(buffer, mimeType, start);
  }

  // ── Image path: send directly to Gemini Vision ────────────────────────────

  private async processImage(
    buffer: Buffer,
    mimeType: string,
    start: number
  ): Promise<OcrResultDto> {
    const base64 = buffer.toString("base64");

    const result = await this.model.generateContent([
      { text: EXTRACTION_PROMPT },
      {
        inlineData: {
          mimeType: mimeType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
          data: base64,
        },
      },
    ]);

    const responseText = result.response.text();
    return this.buildDto(responseText, Date.now() - start);
  }

  // ── PDF path: extract text first, then ask Gemini to parse it ─────────────

  private async processPdf(buffer: Buffer, start: number): Promise<OcrResultDto> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse");
    const pdfData = await pdfParse(buffer, { max: 0 });
    const extractedText: string = pdfData.text ?? "";

    if (!extractedText.trim()) {
      // Likely a scanned PDF (image-only) — return empty result
      return {
        rawText: "",
        confidence: 0,
        processingTimeMs: Date.now() - start,
        parsedItems: [],
        detectedCurrency: null,
        detectedTax: null,
        detectedTip: null,
        detectedTotal: null,
      };
    }

    const result = await this.model.generateContent([
      { text: EXTRACTION_PROMPT },
      { text: `Receipt text:\n\n${extractedText}` },
    ]);

    const responseText = result.response.text();
    return this.buildDto(responseText, Date.now() - start, extractedText);
  }

  // ── Parse Gemini's JSON response into OcrResultDto ────────────────────────

  private buildDto(
    responseText: string,
    processingTimeMs: number,
    fallbackRawText = ""
  ): OcrResultDto {
    const parsed = this.safeParseJson(responseText);

    const parsedItems: ParsedItemDto[] = (parsed.items ?? [])
      .filter((item) => item.name && typeof item.unitPrice === "number" && item.unitPrice >= 0)
      .map((item) => ({
        name: String(item.name).trim(),
        quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
        unitPrice: Number(item.unitPrice),
        rawLine: "",
        confidence: (["high", "medium", "low"].includes(item.confidence)
          ? item.confidence
          : "medium") as "high" | "medium" | "low",
      }));

    return {
      rawText: parsed.rawText ?? fallbackRawText ?? responseText,
      confidence: 1.0,
      processingTimeMs,
      parsedItems,
      detectedCurrency: parsed.detectedCurrency ?? null,
      detectedTax: typeof parsed.detectedTax === "number" ? parsed.detectedTax : null,
      detectedTip: typeof parsed.detectedTip === "number" ? parsed.detectedTip : null,
      detectedTotal: typeof parsed.detectedTotal === "number" ? parsed.detectedTotal : null,
    };
  }

  private safeParseJson(text: string): GeminiResponse {
    try {
      const cleaned = text
        .replace(/^```(?:json)?\s*/im, "")
        .replace(/\s*```\s*$/m, "")
        .trim();
      return JSON.parse(cleaned);
    } catch {
      // Try to extract first JSON object from the response
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try { return JSON.parse(match[0]); } catch { /* ignore */ }
      }
      return { items: [], rawText: text };
    }
  }
}
