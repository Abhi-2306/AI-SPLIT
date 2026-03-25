export type OcrExtractResult = {
  readonly rawText: string;
  readonly confidence: number;
  readonly processingTimeMs: number;
};

export interface IOcrService {
  extractText(imageBuffer: Buffer, mimeType: string): Promise<OcrExtractResult>;
}
