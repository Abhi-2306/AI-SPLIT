import type { IReceiptExtractorService } from "../ports/IReceiptExtractorService";
import type { OcrResultDto } from "../dtos/index";

export type ProcessReceiptOcrInput = {
  imageBuffer: Buffer;
  mimeType: string;
};

/**
 * Processes a receipt file (image or PDF) and returns a structured proposal.
 *
 * Flow — Image:
 *   image buffer → GeminiReceiptService (Vision API) → structured items
 *   (single API call; no separate OCR step needed)
 *
 * Flow — PDF:
 *   pdf-parse → extracted text → GeminiReceiptService (text model) → structured items
 *
 * Returns OcrResultDto — does NOT mutate the bill.
 * The user reviews and confirms items in OcrResultPreview before they are added.
 */
export class ProcessReceiptOcrUseCase {
  constructor(
    private readonly receiptExtractor: IReceiptExtractorService
  ) {}

  async execute(input: ProcessReceiptOcrInput): Promise<OcrResultDto> {
    return this.receiptExtractor.extractAndParse(input.imageBuffer, input.mimeType);
  }
}
