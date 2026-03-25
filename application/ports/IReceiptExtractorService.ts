import type { OcrResultDto } from "../dtos/index";

/**
 * Combined interface for receipt extraction + parsing.
 * Used when a single AI model (e.g. Gemini Vision) can both read
 * the file and structure the data in one call.
 *
 * Replaces the split IOcrService + IReceiptParser pipeline for AI-backed providers.
 */
export interface IReceiptExtractorService {
  extractAndParse(buffer: Buffer, mimeType: string): Promise<OcrResultDto>;
}
