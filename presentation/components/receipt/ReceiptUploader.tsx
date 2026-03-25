"use client";

import { useRef, useState } from "react";
import { Button } from "@/presentation/components/ui/Button";
import { useBillStore } from "@/presentation/store/billStore";
import { useUiStore } from "@/presentation/store/uiStore";
import { SUPPORTED_RECEIPT_TYPES, MAX_UPLOAD_SIZE_BYTES, ACCEPTED_FILE_ATTR } from "@/lib/constants/config";

type ReceiptUploaderProps = {
  billId: string;
};

function getFileIcon(type: string) {
  if (type === "application/pdf") return "📄";
  return "🖼️";
}

export function ReceiptUploader({ billId }: ReceiptUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { uploadReceiptOcr } = useBillStore();
  const { ocrStatus, ocrProgress, setOcrStatus, addToast } = useUiStore();

  const isProcessing = ocrStatus === "uploading" || ocrStatus === "processing";

  function validate(file: File): string | null {
    if (!SUPPORTED_RECEIPT_TYPES.includes(file.type)) {
      return "Unsupported file type. Use JPEG, PNG, WebP, or PDF.";
    }
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return "File too large. Maximum size is 10MB.";
    }
    return null;
  }

  function handleFileSelect(file: File) {
    const error = validate(file);
    if (error) { addToast(error, "error"); return; }
    setSelectedFile(file);
    setOcrStatus("idle", 0);
  }

  async function handleScan() {
    if (!selectedFile) return;
    try {
      setOcrStatus("uploading", 20);
      await new Promise((r) => setTimeout(r, 100)); // let UI update
      setOcrStatus("processing", 55);
      await uploadReceiptOcr(billId, selectedFile);
      setOcrStatus("complete", 100);
      addToast(
        selectedFile.type === "application/pdf"
          ? "PDF parsed successfully!"
          : "Receipt scanned successfully!",
        "success"
      );
      setSelectedFile(null);
    } catch {
      setOcrStatus("error", 0);
      addToast("Processing failed. Please try again or add items manually.", "error");
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    e.target.value = "";
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors cursor-pointer ${
          isDragging
            ? "border-blue-400 bg-blue-50 dark:bg-blue-950"
            : selectedFile
            ? "border-green-400 bg-green-50 dark:bg-green-950"
            : "border-slate-300 dark:border-slate-600 hover:border-slate-400"
        }`}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_FILE_ATTR}
          onChange={onFileChange}
          className="hidden"
        />

        {isProcessing ? (
          <div className="flex flex-col items-center gap-2">
            <span className="text-3xl">⏳</span>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              {ocrStatus === "uploading" ? "Uploading..." : "Extracting items..."}
            </p>
            <div className="w-full max-w-xs bg-slate-200 dark:bg-slate-700 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-700"
                style={{ width: `${ocrProgress}%` }}
              />
            </div>
            <p className="text-xs text-slate-400">{ocrProgress}%</p>
          </div>
        ) : selectedFile ? (
          <div className="flex flex-col items-center gap-1">
            <span className="text-3xl">{getFileIcon(selectedFile.type)}</span>
            <p className="font-medium text-green-700 dark:text-green-300 text-sm">
              {selectedFile.name}
            </p>
            <p className="text-xs text-slate-400">
              {(selectedFile.size / 1024).toFixed(0)} KB ·{" "}
              {selectedFile.type === "application/pdf" ? "PDF" : "Image"}
            </p>
            <p className="text-xs text-slate-400 mt-1">Click to change file</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <span className="text-3xl">📎</span>
            <div>
              <p className="font-medium text-slate-700 dark:text-slate-300 text-sm">
                Drop receipt here or click to browse
              </p>
              <p className="text-xs text-slate-400 mt-1">
                JPEG · PNG · WebP · <strong>PDF</strong> — up to 10MB
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Scan button — only shown after file is selected */}
      {selectedFile && !isProcessing && (
        <Button onClick={handleScan} className="w-full">
          {selectedFile.type === "application/pdf"
            ? "📄 Extract Items from PDF"
            : "📷 Scan Receipt"}
        </Button>
      )}
    </div>
  );
}
