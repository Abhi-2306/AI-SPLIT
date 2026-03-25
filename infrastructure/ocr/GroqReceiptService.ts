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
- If an item name contains a count/pack indicator like "35 count", "12 pk", "6-pack", "24ct", extract that number as the quantity and set unitPrice = total line price ÷ that count. Example: "Coke 35 count 350" → quantity=35, unitPrice=10.
- confidence: "high" = clearly readable, "medium" = somewhat uncertain, "low" = heavily guessed.
- detectedTax: sum ALL tax-related lines (GST, VAT, service charge, service tax, CGST, SGST, cess, etc.) into ONE total number.
- detectedTip: tip or gratuity amount.
- detectedTotal: grand total or amount due.
- detectedCurrency: ISO code (INR, USD, EUR, GBP) inferred from ₹/$€£ or text like "Rs.", "INR".
- Fix obvious OCR errors in names (e.g. "P1ZZA" → "Pizza", "CHIKN" → "Chicken").`;

// ─── Response type ───────────────────────────────────────────────────────────

type GroqResponse = {
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
    return this.buildDto(responseText, Date.now() - start);
  }

  // ── PDF path: extract text first, then ask Llama to parse it ─────────────

  private async processPdf(buffer: Buffer, start: number): Promise<OcrResultDto> {
    // Use pdfjs-dist directly — works reliably with Buffer input
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs") as any;
    const uint8 = new Uint8Array(buffer);
    const doc = await getDocument({ data: uint8 }).promise;
    let extractedText = "";
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      extractedText += content.items.map((item: any) => item.str ?? "").join(" ") + "\n";
    }

    if (!extractedText.trim()) {
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

    const response = await this.client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "user", content: `${EXTRACTION_PROMPT}\n\nReceipt text:\n\n${extractedText}` },
      ],
      temperature: 0,
    });

    const responseText = response.choices[0]?.message?.content ?? "";
    return this.buildDto(responseText, Date.now() - start, extractedText);
  }

  // ── Parse Groq's JSON response into OcrResultDto ─────────────────────────

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
